// Main Sidepanel Orchestration
import {
  sessions,
  cleanupSessions,
  initializeSessions,
  updateApiDownloadStatus,
  updateApiStatus,
  updateModelProgress,
  checkAllModelsComplete,
} from './aiSession.js';
import { classifyTab } from './tabClassifier.js';
import { ungroupCategory, ungroupAll, loadExistingGroups, updateUngroupAllButton } from './groupManager.js';
import {
  displayGroupResults,
  displayExistingGroups,
  updateClusteringProgress,
  setOverallStatus,
} from './uiRenderer.js';

const $ = (s) => document.querySelector(s);

// DOM elements
const organiseTabs = document.getElementById('organise-tabs');
const progressContainer = document.getElementById('progressContainer');
const logEl = document.getElementById('log');

// Logging function
function log(line) {
  logEl.textContent += line + '\n';
}

// Global variable for organized tabs data
let organizedTabsData = [];

// Callbacks object for AI session management
const sessionCallbacks = {
  log,
  updateApiDownloadStatus,
  checkAllModelsComplete: () => checkAllModelsComplete(sessionCallbacks),
  enableOrganiseButton: () => { organiseTabs.disabled = false; },
  disableOrganiseButton: () => { organiseTabs.disabled = true; },
  showProgressContainer: () => { progressContainer.style.display = 'block'; },
  hideProgressContainer: () => { progressContainer.style.display = 'none'; },
};

// Check API availability on load
document.addEventListener('DOMContentLoaded', async () => {
  const hasLanguageModel = 'LanguageModel' in globalThis;
  const hasWriter = 'Writer' in globalThis;
  const hasSummarizer = 'Summarizer' in globalThis;

  // Check detailed availability for each API
  let languageModelStatus = 'unavailable';
  let writerStatus = 'unavailable';
  let summarizerStatus = 'unavailable';

  if (hasLanguageModel) {
    try {
      const availability = await LanguageModel.availability({
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      });
      languageModelStatus = availability === 'downloadable' ? 'downloadable' : 'ready';
    } catch (error) {
      console.warn('Failed to check LanguageModel availability:', error);
      languageModelStatus = 'available';
    }
  }

  if (hasWriter) {
    try {
      const availability = await Writer.availability({
        expectedInputLanguages: ['en'],
        expectedContextLanguages: ['en'],
      });
      writerStatus = availability === 'downloadable' ? 'downloadable' : 'ready';
    } catch (error) {
      console.warn('Failed to check AIWriter availability:', error);
      writerStatus = 'available';
    }
  }

  if (hasSummarizer) {
    try {
      const availability = await Summarizer.availability({
        expectedInputLanguages: ['en'],
        expectedContextLanguages: ['en'],
      });
      summarizerStatus = availability === 'downloadable' ? 'downloadable' : 'ready';
    } catch (error) {
      console.warn('Failed to check AISummarizer availability:', error);
      summarizerStatus = 'available';
    }
  }

  // Update individual API status indicators with detailed status
  updateApiStatus('language-model', languageModelStatus);
  updateApiStatus('writer', writerStatus);
  updateApiStatus('summarizer', summarizerStatus);

  // Create a bitmask for different combinations
  const apiMask = (hasLanguageModel ? 4 : 0) + (hasWriter ? 2 : 0) + (hasSummarizer ? 1 : 0);

  switch (apiMask) {
    case 0: // 000 - No APIs
      setOverallStatus(
        "⚠️ No AI APIs detected. Please ensure you're using Chrome Canary with the experimental AI features enabled.",
        'error',
      );
      break;
    case 1: // 001 - Only Summarizer
      setOverallStatus('⚠️ Only Summarizer available. Missing: Language Model, Writer.', 'warning');
      break;
    case 2: // 010 - Only Writer
      setOverallStatus('⚠️ Only Writer available. Missing: Language Model, Summarizer.', 'warning');
      break;
    case 3: // 011 - Writer + Summarizer
      setOverallStatus('⚠️ Writer and Summarizer available. Missing: Language Model.', 'warning');
      break;
    case 4: // 100 - Only Language Model
      setOverallStatus('⚠️ Only Language Model available. Missing: Writer, Summarizer.', 'warning');
      break;
    case 5: // 101 - Language Model + Summarizer
      setOverallStatus('⚠️ Language Model and Summarizer available. Missing: Writer.', 'warning');
      break;
    case 6: // 110 - Language Model + Writer
      setOverallStatus('⚠️ Language Model and Writer available. Missing: Summarizer.', 'warning');
      break;
    case 7: // 111 - All APIs
      setOverallStatus('🚀 All AI APIs available.', 'success');
      break;
    default:
      setOverallStatus('⚠️ Unexpected API state detected. Please refresh and try again.', 'error');
  }

  // Load existing groups
  loadExistingGroups(displayExistingGroups, updateUngroupAllButton);

  const ungroupAllBtn = document.getElementById('ungroup-all');
  if (ungroupAllBtn) {
    ungroupAllBtn.addEventListener('click', () => ungroupAll(log));
  }
});

// Organize tabs button click handler
organiseTabs.addEventListener('click', async () => {
  try {
    await initializeSessions(sessionCallbacks);
    updateClusteringProgress('Starting clustering process...');

    const result = await performClusteringAndGrouping();

    if (result.success) {
      log('🎉 Clustering completed successfully!');
      // Keep progress visible briefly so user sees completion
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 2000);
    } else {
      console.error('❌ Clustering failed:', result.error);
      log(`❌ Clustering failed: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Error during clustering:', error);
    log(`❌ Error during clustering: ${error.message}`);
  } finally {
    organiseTabs.disabled = false;
  }
});

// Main clustering and grouping function
async function performClusteringAndGrouping() {
  try {
    log('🔄 Starting clustering and grouping process...');

    // Reset organized tabs data
    organizedTabsData = [];

    // 1) Get existing groups and ungroup if necessary
    const existingGroups = await chrome.runtime.sendMessage({ type: 'GET_EXISTING_GROUPS' });
    if (existingGroups?.ok && existingGroups.groups.length > 0) {
      updateClusteringProgress('Ungrouping existing groups...');
      log('🔄 Ungrouping existing groups...');
      await chrome.runtime.sendMessage({ type: 'UNGROUP_ALL' });
      // Clear UI display of old groups
      document.getElementById('results').style.display = 'none';
    }

    // 2) Deduplicate tabs
    updateClusteringProgress('Deduplicating tabs...');
    log('🔄 Deduplicating tabs...');

    const dedupe = await chrome.runtime.sendMessage({ type: 'DEDUPLICATE_TABS' });
    if (dedupe?.ok) log(`✅ Closed duplicates: ${dedupe.closed}`);

    // 3) Get remaining tabs
    const res = await chrome.runtime.sendMessage({ type: 'GET_TABS' });
    if (!res?.ok) throw new Error('Failed to read tabs');
    const tabs = res.tabs.filter((t) => /^https?:/.test(t.url || ''));

    // Enforce maximum tab limit to prevent performance issues
    const MAX_TABS = 100;
    if (tabs.length > MAX_TABS) {
      const message = `⚠️ Too many tabs (${tabs.length}). Processing first ${MAX_TABS} tabs only. Consider closing some tabs for better performance.`;
      log(message);
      updateClusteringProgress(message);
      tabs.splice(MAX_TABS); // Keep only first MAX_TABS
    }

    log(`📊 Processing ${tabs.length} tabs`);

    // 4) Use tab metadata directly (skip content extraction for speed)
    updateClusteringProgress('Preparing tab data...');
    log('🔄 Using tab metadata (title + URL) for classification...');

    const extracted = tabs.map((t) => ({
      tabId: t.id,
      url: t.url,
      title: t.title || '',
      host: new URL(t.url).hostname,
      body: '', // Skip body extraction - title + URL sufficient for classification
    }));

    log(`✅ Prepared ${extracted.length} tabs for classification`);

    // 5) Classify all tabs (in batches for better performance)
    updateClusteringProgress('Classifying tabs...');
    log('🔄 Classifying tabs...');

    const BATCH_SIZE = 5; // Process 5 tabs concurrently
    const classified = [];

    for (let i = 0; i < extracted.length; i += BATCH_SIZE) {
      const batch = extracted.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((item, batchIdx) =>
          classifyTab(
            sessions.languageModel,
            item,
            i + batchIdx + 1,
            extracted.length,
            updateClusteringProgress
          )
        )
      );

      // Combine batch results with original items
      batch.forEach((item, idx) => {
        const cls = batchResults[idx];
        classified.push({
          ...item,
          label: cls.label || 'Other',
          topic: (cls.topic || '').slice(0, 60),
        });
      });
    }

    // Store organized data for later use
    organizedTabsData = classified.map((item) => ({
      tabId: item.tabId,
      title: item.title,
      url: item.url,
      label: item.label,
      topic: item.topic,
      body: item.body,
    }));

    // 6) Group tabs directly by classification label (skip AI clustering for speed)
    updateClusteringProgress('Grouping tabs by category...');
    log('🔄 Grouping tabs by category...');

    const labelGroups = {};
    classified.forEach((item, idx) => {
      const label = item.label || 'Other';
      if (!labelGroups[label]) {
        labelGroups[label] = [];
      }
      labelGroups[label].push(idx);
    });

    // Create clusters structure for display
    const clusters = Object.entries(labelGroups).map(([name, items]) => ({
      name,
      items
    }));

    // 7) Map clusters to tabIds for Chrome grouping
    const groups = clusters.map((c) => ({
      name: c.name,
      tabIds: c.items.map(id => classified[id]?.tabId).filter(Boolean),
    }));

    log(`✅ Created ${groups.length} groups from classifications`);

    // 8) Create Chrome tab groups
    updateClusteringProgress('Creating tab groups...');
    log('🔄 Creating Chrome tab groups...');

    const groupRes = await chrome.runtime.sendMessage({ type: 'GROUP_TABS', groups });

    if (groupRes?.ok) {
      log(`✅ Created ${groupRes.results?.length || 0} groups:`);
      groupRes.results?.forEach((g) => {
        if (g.error) log(` - ${g.name}: error ${g.error}`);
        else log(` - ${g.name}: ${g.count} tab(s)`);
      });

      displayGroupResults(clusters, groupRes.results, organizedTabsData, sessions, log);

      updateClusteringProgress('Complete');
      log('🎉 Clustering and grouping completed successfully!');

      return {
        success: true,
        clusters,
        groupResults: groupRes.results,
      };
    } else {
      throw new Error('Failed to create tab groups');
    }
  } catch (error) {
    log(`❌ Error during clustering: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Handle clicks for ungrouping and tab switching
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('ungroup-btn')) {
    const categoryName = e.target.getAttribute('data-category');
    ungroupCategory(categoryName, e.target, log);
  }

  // Handle URL clicks to switch to tab
  const urlLink = e.target.closest('.url-item-link');
  if (urlLink && urlLink.dataset.tabId) {
    const tabId = parseInt(urlLink.dataset.tabId);
    chrome.tabs.update(tabId, { active: true });
    e.preventDefault();
  }
});

// Clean up sessions when page is unloaded
window.addEventListener('beforeunload', () => {
  cleanupSessions();
});

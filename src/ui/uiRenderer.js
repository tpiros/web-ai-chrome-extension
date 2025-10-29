// UI Rendering Module
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Cache frequently accessed DOM elements
let cachedElements = null;

function getCachedElements() {
  if (!cachedElements) {
    cachedElements = {
      clusteringProgress: document.getElementById('clustering-progress'),
      clusteringStatus: document.getElementById('clustering-status'),
      results: document.getElementById('results'),
      groupsList: document.getElementById('groups-list'),
      ungroupAll: document.getElementById('ungroup-all'),
      overallStatus: document.getElementById('overall-status'),
    };
  }
  return cachedElements;
}

// Chrome group color mapping
function getChromeGroupColor(chromeColor) {
  const colorMap = {
    grey: '#9aa0a6',
    blue: '#8ab4f8',
    red: '#f28b82',
    yellow: '#fdd663',
    green: '#81c995',
    pink: '#ff8bcb',
    purple: '#c58af9',
    cyan: '#78d9ec',
    orange: '#fcad70',
  };
  return colorMap[chromeColor] || '#4caf50';
}

// Shorten URL for display
function shortenUrl(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    return urlObj.hostname + (path.length > 30 ? path.substring(0, 27) + '...' : path);
  } catch (e) {
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get status class for group
function getGroupStatus(result) {
  if (result.error) return 'error';
  if (result.warnings && result.warnings.length > 0) return 'warning';
  return 'success';
}

// Get tabs for a specific group
function getTabsForGroup(originalGroup, organizedTabsData) {
  if (!originalGroup || !originalGroup.items) return [];

  return originalGroup.items
    .map((itemId) => {
      const tabData = organizedTabsData[itemId];
      return tabData || { title: 'Unknown Tab', url: '#', body: '' };
    })
    .filter(Boolean);
}

// Create a group item element
export function createGroupItem(result, originalGroup, organizedTabsData, sessions, log) {
  const groupDiv = document.createElement('div');
  groupDiv.className = `group-item ${getGroupStatus(result)}`;

  if (result.color) {
    const colorValue = getChromeGroupColor(result.color);
    groupDiv.style.setProperty('--group-color', colorValue);
    groupDiv.classList.add('has-color');
  }

  const groupTabs = getTabsForGroup(originalGroup, organizedTabsData);

  const detailsElement = document.createElement('details');
  detailsElement.className = 'group-details';

  const summaryElement = document.createElement('summary');
  summaryElement.className = 'group-summary';
  summaryElement.innerHTML = `
    <span class="group-name">${result.name}</span>
    <div class="group-count">
      <span class="count-badge">${result.count || 0} tabs</span>
      <button class="ungroup-btn" data-category="${result.name}">Ungroup</button>
      <span class="expand-icon">▼</span>
    </div>
  `;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'urls-list';

  if (result.error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = result.error;
    contentDiv.appendChild(errorDiv);
  } else if (result.warnings) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'warning-message';
    warningDiv.textContent = result.warnings.join('; ');
    contentDiv.appendChild(warningDiv);
  }

  // Add summary if group has 5+ URLs
  if (groupTabs && groupTabs.length >= 5) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'group-summary-content';
    summaryDiv.innerHTML = `
      <div class="summary-header">Summary:</div>
      <div class="summary-text">Generating summary...</div>
    `;
    contentDiv.appendChild(summaryDiv);

    // Create expandable overview section
    const overviewDetails = document.createElement('details');
    overviewDetails.className = 'overview-details';

    const overviewSummary = document.createElement('summary');
    overviewSummary.className = 'overview-summary';
    overviewSummary.innerHTML = `
      <span class="overview-label">Overview</span>
      <span class="expand-icon">▼</span>
    `;

    const overviewContent = document.createElement('div');
    overviewContent.className = 'group-writer-content';
    overviewContent.innerHTML = `
      <div class="writer-text">Generating content...</div>
    `;

    overviewDetails.appendChild(overviewSummary);
    overviewDetails.appendChild(overviewContent);
    contentDiv.appendChild(overviewDetails);

    // Generate both summary and content
    (async () => {
      if (log) {
        log(`🔄 Extracting content for ${result.name} summary...`);
      }

      try {
        // Extract content from tabs for better summaries
        const tabsWithContent = await Promise.all(
          groupTabs.map(async (tab) => {
            try {
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
              );
              const extractPromise = chrome.runtime.sendMessage({
                type: 'EXTRACT_TAB_CONTENT',
                tabId: tab.tabId,
              });
              const response = await Promise.race([extractPromise, timeoutPromise]);

              if (response?.ok) {
                return { ...tab, body: response.result.body };
              }
              return tab; // Return without body if extraction fails
            } catch (error) {
              return tab; // Return without body on timeout/error
            }
          })
        );

        if (log) {
          log(`🔄 Generating summary and overview for ${result.name}...`);
        }

        const [summary, content] = await Promise.all([
          generateGroupSummary(tabsWithContent, result.name, sessions.summarizer),
          generateGroupContent(tabsWithContent, result.name, sessions.writer),
        ]);

        // Update summary
        const summaryTextEl = summaryDiv.querySelector('.summary-text');
        if (summary) {
          summaryTextEl.innerHTML = DOMPurify.sanitize(marked.parse(summary));
        } else {
          summaryTextEl.textContent = 'Summary unavailable';
          if (log) {
            log(`⚠️ Summary generation failed for ${result.name}`);
          }
        }

        // Update content
        const contentTextEl = overviewContent.querySelector('.writer-text');
        if (content) {
          contentTextEl.innerHTML = DOMPurify.sanitize(marked.parse(content));
        } else {
          contentTextEl.textContent = 'Content unavailable';
          if (log) {
            log(`⚠️ Overview generation failed for ${result.name}`);
          }
        }

        if (log && summary && content) {
          log(`✅ Summary and overview generated for ${result.name}`);
        }
      } catch (error) {
        if (log) {
          log(`❌ Error generating summary/overview for ${result.name}: ${error.message}`);
        }
      }
    })();
  }

  // Add URL items
  if (groupTabs && groupTabs.length > 0) {
    groupTabs.forEach((tab) => {
      const urlItem = document.createElement('div');
      urlItem.className = 'url-item';
      urlItem.innerHTML = `
        <div class="url-item-link" data-tab-id="${tab.tabId}">
          <div class="url-title">${escapeHtml(tab.title || 'Untitled')}</div>
          <div class="url-link">${escapeHtml(shortenUrl(tab.url))}</div>
        </div>
      `;
      contentDiv.appendChild(urlItem);
    });
  }

  detailsElement.appendChild(summaryElement);
  detailsElement.appendChild(contentDiv);
  groupDiv.appendChild(detailsElement);

  return groupDiv;
}

// Display group results
export function displayGroupResults(clusters, groupResults, organizedTabsData, sessions, log) {
  const elements = getCachedElements();
  const resultsContainer = elements.results;
  const groupsList = elements.groupsList;

  if (!resultsContainer || !groupsList) {
    console.error('Results container elements not found');
    return;
  }

  groupsList.innerHTML = '';

  if (!groupResults || groupResults.length === 0) {
    resultsContainer.style.display = 'none';
    return;
  }

  const ungroupBtn = elements.ungroupAll;
  const hasSuccessfulGroups = groupResults.some((result) => result.count > 0);
  if (ungroupBtn) {
    ungroupBtn.disabled = !hasSuccessfulGroups;
  }

  groupResults.forEach((result, index) => {
    const originalGroup = clusters[index];
    const groupItem = createGroupItem(result, originalGroup, organizedTabsData, sessions, log);
    groupsList.appendChild(groupItem);
  });

  resultsContainer.style.display = 'block';
}

// Create existing group item (for groups loaded on startup)
export function createExistingGroupItem(group) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'group-item success';

  if (group.color) {
    groupDiv.style.setProperty('--group-color', getChromeGroupColor(group.color));
    groupDiv.classList.add('has-color');
  }

  const detailsElement = document.createElement('details');
  detailsElement.className = 'group-details';

  const summaryElement = document.createElement('summary');
  summaryElement.className = 'group-summary';
  summaryElement.innerHTML = `
    <span class="group-name">${group.title}</span>
    <div class="group-count">
      <span class="count-badge">${group.tabs.length} tabs</span>
      <button class="ungroup-btn" data-category="${group.title}">Ungroup</button>
      <span class="expand-icon">▼</span>
    </div>
  `;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'urls-list';

  group.tabs.forEach((tab) => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';
    urlItem.innerHTML = `
      <div class="url-item-link" data-tab-id="${tab.id}">
        <div class="url-title">${escapeHtml(tab.title || 'Untitled')}</div>
        <div class="url-link">${escapeHtml(shortenUrl(tab.url))}</div>
      </div>
    `;
    contentDiv.appendChild(urlItem);
  });

  detailsElement.appendChild(summaryElement);
  detailsElement.appendChild(contentDiv);
  groupDiv.appendChild(detailsElement);

  return groupDiv;
}

// Display existing groups
export function displayExistingGroups(groups) {
  const elements = getCachedElements();
  const resultsContainer = elements.results;
  const groupsList = elements.groupsList;

  groupsList.innerHTML = '';

  groups.forEach((group) => {
    const groupItem = createExistingGroupItem(group);
    groupsList.appendChild(groupItem);
  });

  resultsContainer.style.display = 'block';
}

// Update clustering progress
export function updateClusteringProgress(message) {
  const elements = getCachedElements();
  const clusteringProgress = elements.clusteringProgress;
  const clusteringStatus = elements.clusteringStatus;

  if (message === 'Complete') {
    // Keep completion message visible briefly before hiding
    setTimeout(() => {
      clusteringProgress.style.display = 'none';
    }, 2000);
  } else {
    clusteringProgress.style.display = 'block';
  }

  clusteringStatus.textContent = message;
}

// Set overall status message
export function setOverallStatus(message, type) {
  const elements = getCachedElements();
  const overallStatus = elements.overallStatus;
  overallStatus.textContent = message;

  // Remove existing status classes
  overallStatus.classList.remove('success', 'warning', 'error');

  // Add appropriate class
  overallStatus.classList.add(type);
}

// Generate group summary using AI
async function generateGroupSummary(groupTabs, groupName, summarizerSession) {
  try {
    const combinedContent = groupTabs
      .map((tab) => `Title: ${tab.title}\nURL: ${tab.url}\nContent: ${tab.body || ''}`)
      .join('\n\n---\n\n');

    const summary = await summarizerSession.summarize(combinedContent, {
      context: `These web pages are all related to ${groupName}. Summarize the key themes and topics.`,
    });

    return summary;
  } catch (error) {
    return 'Summary generation failed';
  }
}

// Generate group content using AI
async function generateGroupContent(groupTabs, groupName, writerSession) {
  try {
    const tabTitles = groupTabs.map((tab) => tab.title).join(', ');
    const prompt = `Write a brief overview of these ${groupName} topics: ${tabTitles}`;

    const content = await writerSession.write(prompt, {
      context: `These are web pages about ${groupName} that a user has grouped together for research or reference.`,
    });

    return content;
  } catch (error) {
    return null;
  }
}

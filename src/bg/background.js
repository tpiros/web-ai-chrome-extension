chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Failed to set panel behavior:', error));
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TABS') {
    handleGetTabs(sendResponse);
    return true;
  }

  if (request.type === 'DEDUPLICATE_TABS') {
    handleDeduplicateTabs(sendResponse);
    return true;
  }

  if (request.type === 'GROUP_TABS') {
    handleGroupTabs(request.groups, sendResponse);
    return true;
  }

  if (request.type === 'EXTRACT_TAB_CONTENT') {
    handleExtractTabContent(request.tabId, sendResponse);
    return true;
  }

  if (request.type === 'UNGROUP_ALL') {
    handleUngroupAll(sendResponse);
    return true;
  }

  if (request.type === 'UNGROUP_CATEGORY') {
    handleUngroupCategory(request.categoryName, sendResponse);
    return true;
  }

  if (request.type === 'CHECK_GROUPS') {
    handleCheckGroups(sendResponse);
    return true;
  }

  if (request.type === 'GET_EXISTING_GROUPS') {
    handleGetExistingGroups(sendResponse);
    return true;
  }
});

/**
 * Retrieves all existing tab groups with their tabs
 * @param {Function} sendResponse - Callback to send response back to caller
 */
async function handleGetExistingGroups(sendResponse) {
  try {
    const tabGroups = await chrome.tabGroups.query({});
    const groups = [];

    for (const group of tabGroups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      groups.push({
        id: group.id,
        title: group.title || 'Untitled Group',
        color: group.color,
        tabs: tabs.map((tab) => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
        })),
      });
    }

    sendResponse({ ok: true, groups });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
}

/**
 * Checks if any tab groups currently exist
 * @param {Function} sendResponse - Callback to send response back to caller
 */
async function handleCheckGroups(sendResponse) {
  try {
    const tabGroups = await chrome.tabGroups.query({});
    sendResponse({ ok: true, hasGroups: tabGroups.length > 0 });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
}

async function handleUngroupAll(sendResponse) {
  try {
    const tabGroups = await chrome.tabGroups.query({});
    let totalUngrouped = 0;

    for (const group of tabGroups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      const tabIds = tabs.map((tab) => tab.id);
      await chrome.tabs.ungroup(tabIds);
      totalUngrouped++;
    }

    // Brief delay to allow Chrome to process the ungroup operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    sendResponse({ ok: true, ungrouped: totalUngrouped });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
}

async function handleUngroupCategory(categoryName, sendResponse) {
  try {
    const tabGroups = await chrome.tabGroups.query({ title: categoryName });
    let totalUngrouped = 0;

    for (const group of tabGroups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      const tabIds = tabs.map((tab) => tab.id);
      await chrome.tabs.ungroup(tabIds);
      totalUngrouped++;
    }

    sendResponse({ ok: true, ungrouped: totalUngrouped });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
}

async function handleGetTabs(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({});
    const validTabs = tabs.filter(
      (tab) =>
        tab.url &&
        tab.url.startsWith('http') &&
        !tab.url.includes('chrome://') &&
        !tab.url.includes('chrome-extension://'),
    );

    sendResponse({ ok: true, tabs: validTabs });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
}

async function handleDeduplicateTabs(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({});
    const validTabs = tabs.filter(
      (tab) =>
        tab.url &&
        tab.url.startsWith('http') &&
        !tab.url.includes('chrome://') &&
        !tab.url.includes('chrome-extension://'),
    );

    const seen = new Map();
    const toClose = [];

    for (const tab of validTabs) {
      try {
        const host = new URL(tab.url).hostname;
        const normalizedTitle = (tab.title || '').toLowerCase().trim();
        const key = `${host}:${normalizedTitle}`;

        if (seen.has(key)) {
          toClose.push(tab.id);
        } else {
          seen.set(key, tab);
        }
      } catch (e) {
        console.log(`Skipping tab with invalid URL: ${tab.url}`);
      }
    }

    if (toClose.length > 0) {
      await chrome.tabs.remove(toClose);
    }

    sendResponse({ ok: true, closed: toClose.length });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
}

/**
 * Creates Chrome tab groups from provided group definitions
 * @param {Array} groups - Array of group objects with name and tabIds
 * @param {Function} sendResponse - Callback to send response back to caller
 */
async function handleGroupTabs(groups, sendResponse) {
  try {
    // Get the last focused window (the one user is viewing)
    const currentWindow = await chrome.windows.getLastFocused();
    if (currentWindow.type !== 'normal') {
      sendResponse({ ok: false, error: 'Extension must be used in a normal browser window' });
      return;
    }
    const results = [];

    for (const group of groups) {
      try {
        if (!group.tabIds || group.tabIds.length === 0) {
          results.push({
            name: group.name,
            error: 'No tabs to group',
            count: 0,
          });
          continue;
        }

        const validTabIds = [];
        for (const tabId of group.tabIds) {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab && tab.windowId === currentWindow.id) {
              validTabIds.push(tabId);
            }
          } catch (e) {
            // Tab might have been closed, skip it
          }
        }

        if (validTabIds.length === 0) {
          results.push({
            name: group.name,
            error: 'No valid tabs in current window',
            count: 0,
          });
          continue;
        }

        // Small delay between group operations to prevent Chrome API throttling
        await new Promise((resolve) => setTimeout(resolve, 50));

        const groupId = await chrome.tabs.group({
          tabIds: validTabIds,
        });

        await chrome.tabGroups.update(groupId, {
          title: group.name,
          collapsed: false,
        });

        // Get the actual group info including color
        const groupInfo = await chrome.tabGroups.get(groupId);

        results.push({
          name: group.name,
          count: validTabIds.length,
          color: groupInfo.color,
        });
      } catch (error) {
        console.log(`Error grouping ${group.name}:`, error);
        results.push({
          name: group.name,
          error: error.message,
          count: 0,
        });
      }
    }

    sendResponse({ ok: true, results });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
}

/**
 * Extracts content from a specific tab using content script injection
 * @param {number} tabId - The ID of the tab to extract content from
 * @param {Function} sendResponse - Callback to send response back to caller
 */
async function handleExtractTabContent(tabId, sendResponse) {
  try {
    // First, check if the tab is accessible
    const tab = await chrome.tabs.get(tabId);

    // Check if it's a protected URL
    if (!tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:')) {
      sendResponse({
        ok: false,
        error: 'Cannot access protected browser pages',
        isProtected: true
      });
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: extractPageContent,
    });

    if (results && results[0] && results[0].result) {
      sendResponse({ ok: true, result: results[0].result });
    } else {
      sendResponse({ ok: false, error: 'No content extracted from page' });
    }
  } catch (error) {
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.message.includes('Cannot access')) {
      errorMessage = 'Cannot inject scripts into this page (protected or restricted)';
    } else if (error.message.includes('No tab')) {
      errorMessage = 'Tab no longer exists';
    }

    sendResponse({ ok: false, error: errorMessage });
  }
}

/**
 * Extracts title, host, and body text from the current page
 * This function runs in the context of the target tab
 * @returns {{title: string, host: string, body: string}} Extracted page content
 */
function extractPageContent() {
  try {
    const title = document.title || '';
    const host = window.location.hostname || '';

    // Simple content extraction
    let body = document.body ? document.body.innerText || document.body.textContent || '' : '';

    // Clean up and limit content (optimized for summaries)
    body = body.replace(/\s+/g, ' ').trim().slice(0, 1500);

    return { title, host, body };
  } catch (error) {
    return {
      title: document.title || '',
      host: window.location.hostname || '',
      body: '',
    };
  }
}

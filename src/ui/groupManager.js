// Tab Group Management Module

// Ungroup a specific category
export async function ungroupCategory(categoryName, buttonElement, logCallback) {
  try {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Ungrouping...';

    const response = await chrome.runtime.sendMessage({
      type: 'UNGROUP_CATEGORY',
      categoryName: categoryName,
    });

    if (response?.ok) {
      logCallback(`Ungrouped category: ${categoryName}`);

      // Hide this specific group item
      const groupItem = buttonElement.closest('.group-item');
      if (groupItem) {
        groupItem.remove(); // Remove instead of just hiding
      }

      // Check if any groups still exist and update display
      const remainingGroups = document.querySelectorAll('.group-item');
      if (remainingGroups.length === 0) {
        document.getElementById('results').style.display = 'none';
      }
    } else {
      logCallback(`Error ungrouping ${categoryName}: ${response?.error || 'Unknown error'}`);
    }
  } catch (error) {
    logCallback(`Error ungrouping ${categoryName}: ${error.message}`);
  } finally {
    if (buttonElement) {
      buttonElement.disabled = false;
      buttonElement.textContent = 'Ungroup';
    }
  }
}

// Ungroup all tab groups
export async function ungroupAll(logCallback) {
  try {
    const btn = document.getElementById('ungroup-all');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Ungrouping...';

    const response = await chrome.runtime.sendMessage({
      type: 'UNGROUP_ALL',
    });

    if (response?.ok) {
      logCallback('All tab groups removed');
      document.getElementById('results').style.display = 'none';
      btn.disabled = true; // Keep disabled until new groups are created
      btn.textContent = 'Ungroup All';
    }
  } catch (error) {
    logCallback(`Error ungrouping all: ${error.message}`);
    const btn = document.getElementById('ungroup-all');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Ungroup All';
    }
  }
}

// Load existing tab groups on startup
export async function loadExistingGroups(displayCallback, updateButtonCallback) {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_EXISTING_GROUPS' });
    if (response?.ok && response.groups.length > 0) {
      displayCallback(response.groups);
      updateButtonCallback(true);
    }
  } catch (error) {
    console.error('Error loading existing groups:', error);
  }
}

// Update the ungroup all button state
export function updateUngroupAllButton(hasGroups) {
  const ungroupBtn = document.getElementById('ungroup-all');
  if (ungroupBtn) {
    ungroupBtn.disabled = !hasGroups;
  }
}

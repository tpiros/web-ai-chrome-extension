// Tab Classification and Clustering Module

/**
 * Extracts content from a tab via background script
 * @param {number} tabId - The ID of the tab to extract content from
 * @returns {Promise<{title: string, host: string, body: string}>} Extracted content
 */
export async function extractFromTab(tabId) {
  const response = await chrome.runtime.sendMessage({
    type: 'EXTRACT_TAB_CONTENT',
    tabId,
  });
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

/**
 * Classifies a tab into a category using AI
 * @param {Object} session - The AI language model session
 * @param {Object} tabMeta - Tab metadata (title, host, body)
 * @param {number} idx - Current tab index
 * @param {number} total - Total number of tabs
 * @param {Function} updateProgressCallback - Callback for progress updates
 * @returns {Promise<{label: string, topic: string}>} Classification result
 */
export async function classifyTab(session, tabMeta, idx, total, updateProgressCallback) {
  const { title, host, body } = tabMeta;

  const prompt = `# TASK: Classify the provided web page.

  # INSTRUCTIONS:
  1.  Your entire response MUST be a single, valid JSON object. Do not add any explanatory text, markdown, or any characters outside the JSON object.
  2.  The JSON structure must be exactly: '{ "label": "category", "topic": "brief description"}'.
  3.  For the "label" value, you MUST use only ONE word from this specific list: ["News", "Sports", "Shopping", "Travel", "Learning", "Work", "Development", "Social", "Finance", "Entertainment", "Other"].
  4.  For the "topic" value, provide a concise 3-5 word summary of the page's main subject.

  # PAGE DATA:
  TITLE: ${title}
  HOST: ${host}
  CONTENT: ${body}
  `;

  updateProgressCallback(`Classifying ${idx}/${total}`);

  if (!session) {
    throw new Error('Language model session not available');
  }

  let raw;
  try {
    raw = await session.prompt(prompt);
  } catch (e) {
    updateProgressCallback(`Classify error on ${idx}/${total}`);
    console.error(`[PromptAPI] classify failed on tab ${idx}: ${e?.message || e}`);
    return { label: 'Other', topic: (title || 'Unknown').slice(0, 40) };
  }

  try {
    const obj = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return {
      label: obj.label || 'Other',
      topic: (obj.topic || title || 'Unknown').slice(0, 60),
    };
  } catch {
    return { label: 'Other', topic: (title || 'Unknown').slice(0, 60) };
  }
}

/**
 * Clusters classified tabs into groups using AI
 * @param {Object} session - The AI language model session
 * @param {Array} classified - Array of classified tab objects
 * @param {Function} updateProgressCallback - Callback for progress updates
 * @returns {Promise<Array>} Array of cluster objects with name and item IDs
 */
export async function clusterTabs(session, classified, updateProgressCallback) {
  updateProgressCallback('Clustering tabs…');

  const items = classified.map((it, idx) => ({
    id: idx,
    title: it.title || '',
    topic: it.topic || '',
    label: it.label || 'Other',
  }));

  const clusterPrompt = `# TASK: Group the provided web page items into meaningful clusters.

    # INSTRUCTIONS:
    1.  Your entire response MUST be a single, valid JSON array. Do not add any text or markdown outside the JSON array.
    2.  Each object in the array represents one cluster and must follow this exact structure: '{ "name": "cluster_name", "items": [id1, id2, ...] }'.
    3.  The "name" value MUST be EXACTLY ONE WORD chosen from this specific list: ["News", "Sports", "Shopping", "Travel", "Learning", "Work", "Development", "Social", "Finance", "Entertainment", "Gaming", "Music", "Videos", "Articles", "Research", "Tools", "Documentation", "Other"].
    4.  The "items" value must be an array of the integer IDs that belong to the cluster.
    5.  Group items by their shared topic. Every item ID must be assigned to exactly one cluster. It is acceptable to create a cluster with only one item if it is unique.

    # ITEMS TO CLUSTER:
    ${items.map((it) => `ID ${it.id}: ${it.label} - ${it.title} (${it.topic})`).join('\n')}`;

  if (!session) {
    throw new Error('Language model session not available');
  }

  const rawClusters = await session.prompt(clusterPrompt);

  // Parse clustering results
  let clusters;
  try {
    clusters = JSON.parse(rawClusters.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('⚠️ Failed to parse clustering results, using fallback');
    clusters = [{ name: 'Other', items: items.map((x) => x.id) }];
  }

  return clusters;
}

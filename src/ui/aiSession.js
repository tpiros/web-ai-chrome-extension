/**
 * AI Session Management Module
 * Handles creation, monitoring, and cleanup of AI model sessions
 */

export const sessions = {
  languageModel: null,
  writer: null,
  summarizer: null,
};

export const progress = {
  languageModel: 0,
  writer: 0,
  summarizer: 0,
};

// Cache DOM elements for progress indicators (initialized on first use)
let progressElements = null;

function getProgressElements() {
  if (!progressElements) {
    progressElements = {
      languageModelProgress: document.getElementById('languageModelProgress'),
      languageModelText: document.getElementById('languageModelText'),
      writerProgress: document.getElementById('writerProgress'),
      writerText: document.getElementById('writerText'),
      summarizerProgress: document.getElementById('summarizerProgress'),
      summarizerText: document.getElementById('summarizerText'),
    };
  }
  return progressElements;
}

/**
 * Cleans up AI sessions to prevent memory leaks
 * Should be called when sessions are no longer needed
 */
export function cleanupSessions() {
  try {
    if (sessions.languageModel) {
      sessions.languageModel.destroy?.();
      sessions.languageModel = null;
    }
    if (sessions.writer) {
      sessions.writer.destroy?.();
      sessions.writer = null;
    }
    if (sessions.summarizer) {
      sessions.summarizer.destroy?.();
      sessions.summarizer = null;
    }
    console.log('🧹 AI sessions cleaned up');
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
}

// Update model download progress
export function updateModelProgress(modelType, percentage, callbacks) {
  progress[modelType] = percentage;

  const elements = getProgressElements();
  const progressElement = elements[`${modelType}Progress`];
  const textElement = elements[`${modelType}Text`];

  if (progressElement) {
    progressElement.value = percentage;
  } else {
    console.error(`❌ Progress element not found: ${modelType}Progress`);
  }

  if (textElement) {
    textElement.textContent = `${Math.round(percentage)}%`;
  } else {
    console.error(`❌ Text element not found: ${modelType}Text`);
  }

  // Update API status indicator
  if (percentage >= 100) {
    callbacks.updateApiDownloadStatus(modelType === 'languageModel' ? 'language-model' : modelType, 'ready');
  } else if (percentage > 0) {
    callbacks.updateApiDownloadStatus(
      modelType === 'languageModel' ? 'language-model' : modelType,
      'downloading',
    );
  }

  callbacks.checkAllModelsComplete();
}

export function checkAllModelsComplete(callbacks) {
  const allComplete = Object.values(progress).every((p) => p >= 100);
  if (allComplete) {
    callbacks.log('✅ All models ready!', 'success');
    callbacks.enableOrganiseButton();
    // Keep progress visible briefly so user sees completion before hiding
    setTimeout(() => {
      callbacks.hideProgressContainer();
    }, 2000);
  }
}

/**
 * Initializes all AI sessions (LanguageModel, Writer, Summarizer)
 * Downloads models if needed and monitors progress
 * @param {Object} callbacks - Object containing callback functions for UI updates
 * @throws {Error} If session initialization fails
 */
export async function initializeSessions(callbacks) {
  const [lmStatus, summarizerStatus, writerStatus] = await Promise.all([
    LanguageModel.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    }),
    Summarizer.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      outputLanguage: 'en',
    }),
    Writer.availability({
      expectedInputLanguages: ['en'],
      expectedContextLanguages: ['en'],
    }),
  ]);

  if (
    lmStatus !== 'available' ||
    summarizerStatus !== 'available' ||
    writerStatus !== 'available'
  ) {
    try {
      callbacks.disableOrganiseButton();
      callbacks.showProgressContainer();
      callbacks.log('🔄 Initializing models sequentially...', 'info');

      sessions.languageModel = await LanguageModel.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            updateModelProgress('languageModel', e.loaded * 100, callbacks);
          });
        },
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      });

      // Sequential initialization with delay to prevent concurrent download conflicts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      sessions.writer = await Writer.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            updateModelProgress('writer', e.loaded * 100, callbacks);
          });
        },
        expectedInputLanguages: ['en'],
        expectedContextLanguages: ['en'],
      });

      // Sequential initialization with delay to prevent concurrent download conflicts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      sessions.summarizer = await Summarizer.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            updateModelProgress('summarizer', e.loaded * 100, callbacks);
          });
        },
        expectedInputLanguages: ['en'],
        expectedContextLanguages: ['en'],
        outputLanguage: 'en',
      });
      callbacks.log('✅ All models ready!', 'success');
    } catch (error) {
      console.error('Sequential creation failed:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      callbacks.log(`❌ Failed to initialize: ${error.message}`, 'error');
      callbacks.enableOrganiseButton();
      callbacks.hideProgressContainer();
      throw error;
    }
  } else {
    sessions.languageModel = await LanguageModel.create({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });

    sessions.writer = await Writer.create({
      expectedInputLanguages: ['en'],
      expectedContextLanguages: ['en'],
    });

    sessions.summarizer = await Summarizer.create({
      expectedInputLanguages: ['en'],
      expectedContextLanguages: ['en'],
      outputLanguage: 'en',
    });
  }
}

// Update API status indicators
export function updateApiDownloadStatus(apiId, state) {
  const apiElement = document.getElementById(apiId);
  const indicator = apiElement.querySelector('.status-indicator');

  // Remove existing status classes
  indicator.classList.remove('status-ready', 'status-warning', 'status-error');
  apiElement.classList.remove('available', 'ready');

  switch (state) {
    case 'ready':
      indicator.classList.add('status-ready');
      apiElement.classList.add('ready');
      break;
    case 'downloading':
      indicator.classList.add('status-warning');
      apiElement.classList.add('available');
      break;
    case 'unavailable':
    default:
      indicator.classList.add('status-error');
      break;
  }
}

export function updateApiStatus(apiId, status) {
  const apiElement = document.getElementById(apiId);
  const indicator = apiElement.querySelector('.status-indicator');

  // Remove existing status classes
  indicator.classList.remove('status-ready', 'status-warning', 'status-error');
  apiElement.classList.remove('available');

  switch (status) {
    case 'ready':
      indicator.classList.add('status-ready');
      apiElement.classList.add('available');
      break;
    case 'downloadable':
      indicator.classList.add('status-warning'); // Orange for needs download
      apiElement.classList.add('available');
      break;
    case 'available': // fallback case
      indicator.classList.add('status-ready');
      apiElement.classList.add('available');
      break;
    case 'unavailable':
    default:
      indicator.classList.add('status-error');
      break;
  }
}

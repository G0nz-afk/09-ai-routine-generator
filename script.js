const routineForm = document.getElementById('routineForm');
const preferencesStorageKey = 'routinePreferences';
const themeStorageKey = 'routineTheme';
const themeToggleButton = document.getElementById('themeToggle');

// Prefer a proxy URL (like a Cloudflare Worker) when available.
// This keeps secret keys off the client and avoids direct 401 errors from OpenAI.
const apiUrl = (typeof CLOUDFLARE_WORKER_URL === 'string' && CLOUDFLARE_WORKER_URL.trim() !== '')
  ? CLOUDFLARE_WORKER_URL
  : 'https://api.openai.com/v1/chat/completions';

// Apply a theme and keep toggle text/icon in sync with the current mode
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);

  if (theme === 'light') {
    themeToggleButton.innerHTML = '<i class="fas fa-moon"></i> Dark Mode';
    themeToggleButton.setAttribute('aria-label', 'Switch to dark mode');
  } else {
    themeToggleButton.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    themeToggleButton.setAttribute('aria-label', 'Switch to light mode');
  }
}

// Load the saved theme preference when the page opens
function loadTheme() {
  const savedTheme = localStorage.getItem(themeStorageKey);
  const theme = savedTheme === 'light' ? 'light' : 'dark';
  applyTheme(theme);
}

// Toggle between dark and light themes
themeToggleButton.addEventListener('click', () => {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  localStorage.setItem(themeStorageKey, nextTheme);
});

// Save current form values to localStorage
function savePreferences() {
  const selectedActivityElements = document.querySelectorAll('input[name="activities"]:checked');
  const preferredActivities = Array.from(selectedActivityElements).map((activity) => activity.value);

  const preferences = {
    timeOfDay: document.getElementById('timeOfDay').value,
    focusArea: document.getElementById('focusArea').value,
    timeAvailable: document.getElementById('timeAvailable').value,
    energyLevel: document.getElementById('energyLevel').value,
    preferredActivities: preferredActivities
  };

  localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
}

// Load saved form values from localStorage when the page opens
function loadPreferences() {
  const savedPreferences = localStorage.getItem(preferencesStorageKey);

  if (!savedPreferences) {
    return;
  }

  const preferences = JSON.parse(savedPreferences);

  if (preferences.timeOfDay) {
    document.getElementById('timeOfDay').value = preferences.timeOfDay;
  }

  if (preferences.focusArea) {
    document.getElementById('focusArea').value = preferences.focusArea;
  }

  if (preferences.timeAvailable) {
    document.getElementById('timeAvailable').value = preferences.timeAvailable;
  }

  if (preferences.energyLevel) {
    document.getElementById('energyLevel').value = preferences.energyLevel;
  }

  if (Array.isArray(preferences.preferredActivities)) {
    const activityCheckboxes = document.querySelectorAll('input[name="activities"]');

    activityCheckboxes.forEach((checkbox) => {
      checkbox.checked = preferences.preferredActivities.includes(checkbox.value);
    });
  }
}

// Restore saved preferences right away and keep saving on every form change
loadTheme();
loadPreferences();
routineForm.addEventListener('change', savePreferences);

// Add an event listener to the form that runs when the form is submitted
routineForm.addEventListener('submit', async (e) => {
  // Prevent the form from refreshing the page
  e.preventDefault();
  
  // Get values from each form input
  const timeOfDay = document.getElementById('timeOfDay').value;
  const focusArea = document.getElementById('focusArea').value;
  const timeAvailable = document.getElementById('timeAvailable').value;
  const energyLevel = document.getElementById('energyLevel').value;

  // Get all selected preferred activities and store them in an array
  const selectedActivityElements = document.querySelectorAll('input[name="activities"]:checked');
  const preferredActivities = Array.from(selectedActivityElements).map((activity) => activity.value);
  const preferredActivitiesText = preferredActivities.length > 0
    ? preferredActivities.join(', ')
    : 'No specific preferred activities selected';

  // Build the user prompt using the selected values
  const userPrompt = `Create a personalized daily routine using these details:\n\nTime of day: ${timeOfDay}\nFocus area: ${focusArea}\nTime available: ${timeAvailable} minutes\nEnergy level: ${energyLevel}\nPreferred activities: ${preferredActivitiesText}\n\nPlease provide a structured, step-by-step routine that fits these parameters. Keep it realistic and practical.`;

  // Save one more time on submit to make sure latest values are stored
  savePreferences();
  
  // Find the submit button and update its appearance to show loading state
  const button = document.querySelector('button[type="submit"]');
  button.textContent = 'Generating...';
  button.disabled = true;
  
  try {    
    const headers = {
      'Content-Type': 'application/json'
    };

    // Only send Authorization when calling OpenAI directly.
    // Proxy endpoints usually handle auth on the server side.
    if (apiUrl === 'https://api.openai.com/v1/chat/completions') {
      const openAiKey = typeof OPENAI_API_KEY === 'string' ? OPENAI_API_KEY : '';

      if (!openAiKey || openAiKey === 'paste-your-openai-api-key-here') {
        throw new Error('Missing OpenAI API key. Add a valid key in secrets.js or use a worker URL.');
      }

      headers.Authorization = `Bearer ${openAiKey}`;
    }

    // Make the API call
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [      
          { role: 'system', content: `You are a helpful assistant that creates quick, focused daily routines. Always keep routines short, realistic, and tailored to the user's preferences.` },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 500
      })
    });
    
    const data = await response.json();

    if (!response.ok) {
      const apiMessage = data?.error?.message || `Request failed with status ${response.status}`;
      throw new Error(apiMessage);
    }

    if (!data?.choices?.[0]?.message?.content) {
      throw new Error('No routine was returned by the API.');
    }

    // Convert API response to JSON and get the generated routine
    const routine = data.choices[0].message.content;
    
    // Show the result section and display the routine
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('routineOutput').textContent = routine;
    
  } catch (error) {
    // If anything goes wrong, log the error and show user-friendly message
    console.error('Error:', error);
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('routineOutput').textContent = `Sorry, there was an error: ${error.message}`;
  } finally {
    // Always reset the button back to its original state using innerHTML to render the icon
    button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate My Routine';
    button.disabled = false;
  }
});

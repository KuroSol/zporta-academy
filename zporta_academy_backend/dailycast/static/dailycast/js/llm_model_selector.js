/**
 * LLM Model Selector - Dynamic model dropdown based on provider selection
 *
 * This script automatically updates the available models when you change the LLM provider.
 * For example:
 * - If you select "OpenAI", you'll see: gpt-4o-mini, gpt-4-turbo, gpt-4, etc.
 * - If you select "Gemini", you'll see: gemini-2.0-pro-exp, gemini-1.5-pro, etc.
 */

(function () {
  // Cost map: USD per 1,000,000 tokens
  const COST_PER_MILLION = {
    openai: {
      "gpt-4o-mini": 0.15,
      "gpt-4o": 2.5,
      "gpt-4-turbo": 10.0,
      "gpt-4": 30.0,
      "gpt-3.5-turbo": 1.0,
    },
    gemini: {
      "gemini-1.5-flash": 0.075,
      "gemini-1.5-pro": 1.25,
      "gemini-2.0-pro-exp": 3.5,
      "gemini-pro": 1.5,
    },
    claude: {
      "claude-3-haiku": 0.25,
      "claude-3-sonnet": 3.0,
      "claude-3-5-sonnet": 15.0,
      "claude-3-opus": 15.0,
    },
    template: {
      template: 0,
    },
  };

  // Wait for page to load
  document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ LLM Model Selector initialized");

    // Find the LLM provider dropdown
    const providerSelect = document.querySelector(".llm-provider-select");
    const modelSelect =
      document.getElementById("llm_model_select") ||
      document.querySelector('select[name="llm_model"]');
    const priceInput = document.querySelector(
      'input[name="cost_per_generation"]'
    );
    const wordLimitInput = document.querySelector(
      'input[name="script_word_limit"]'
    );

    if (!providerSelect || !modelSelect) {
      console.warn("⚠️ LLM provider or model selector not found");
      return;
    }

    // Add click handlers for tooltip display
    addProviderTooltips(providerSelect);

    // Update models when provider changes
    providerSelect.addEventListener("change", function (e) {
      console.log("🔄 Provider changed to:", this.value);
      updateModelDropdown(this.value, modelSelect);
      updateTokenBudgetDisplay(
        providerSelect,
        modelSelect,
        priceInput,
        wordLimitInput
      );
    });

    // Update token budget when model or price changes
    modelSelect.addEventListener("change", function () {
      updateTokenBudgetDisplay(
        providerSelect,
        modelSelect,
        priceInput,
        wordLimitInput
      );
    });
    if (priceInput) {
      priceInput.addEventListener("input", function () {
        updateTokenBudgetDisplay(
          providerSelect,
          modelSelect,
          priceInput,
          wordLimitInput
        );
      });
    }
    if (wordLimitInput) {
      wordLimitInput.addEventListener("input", function () {
        updateTokenBudgetDisplay(
          providerSelect,
          modelSelect,
          priceInput,
          wordLimitInput
        );
      });
    }

    // Initialize on page load
    updateModelDropdown(providerSelect.value, modelSelect);
    updateTokenBudgetDisplay(
      providerSelect,
      modelSelect,
      priceInput,
      wordLimitInput
    );
  });

  /**
   * Add tooltip functionality to provider select
   */
  function addProviderTooltips(selectElement) {
    selectElement.addEventListener("focus", function () {
      showProviderTooltip(this.value);
    });

    selectElement.addEventListener("change", function () {
      showProviderTooltip(this.value);
    });
  }

  /**
   * Show tooltip with provider information (fetched from server)
   */
  function showProviderTooltip(provider) {
    // Fetch tooltip from AJAX endpoint
    const apiUrl = "/api/admin/ajax/llm-models/?provider=" + encodeURIComponent(provider);
    
    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        if (data.tooltip) {
          console.log(`📋 Provider tooltip: ${data.tooltip}`);
          showTooltipNotification(data.tooltip);
        }
      })
      .catch(error => {
        console.warn("⚠️ Could not fetch tooltip:", error);
      });
  }

  /**
   * Update model dropdown via AJAX
   */
  function updateModelDropdown(provider, selectElement) {
    // The endpoint is now at: /api/admin/ajax/llm-models/
    // This is a global AJAX endpoint that works from any admin page
    const apiUrl =
      "/api/admin/ajax/llm-models/?provider=" + encodeURIComponent(provider);

    console.log("📡 Fetching models from:", apiUrl);

    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Network response was not ok: ${response.status} ${response.statusText}`
          );
        }
        return response.json();
      })
      .then((data) => {
        console.log("✅ Received models:", data.models);

        // Clear current options
        selectElement.innerHTML = "";

        // Add new options
        data.models.forEach((model) => {
          const option = document.createElement("option");
          option.value = model.value;
          option.textContent = model.label;
          selectElement.appendChild(option);
        });

        // Show tooltip
        if (data.tooltip) {
          showTooltipNotification(data.tooltip);
        }

        console.log(
          "✅ Model dropdown updated with " + data.models.length + " options"
        );
        // Recompute budget after models update
        const providerSelect = document.querySelector(".llm-provider-select");
        const priceInput = document.querySelector(
          'input[name="cost_per_generation"]'
        );
        const wordLimitInput = document.querySelector(
          'input[name="script_word_limit"]'
        );
        updateTokenBudgetDisplay(
          providerSelect,
          selectElement,
          priceInput,
          wordLimitInput
        );
      })
      .catch((error) => {
        console.error("❌ Error fetching models:", error);
        // Show fallback message
        showErrorNotification("Could not load models. Trying fallback...");
        // Use fallback models
        useFallbackModels(provider, selectElement);
        const providerSelect = document.querySelector(".llm-provider-select");
        const priceInput = document.querySelector(
          'input[name="cost_per_generation"]'
        );
        const wordLimitInput = document.querySelector(
          'input[name="script_word_limit"]'
        );
        updateTokenBudgetDisplay(
          providerSelect,
          selectElement,
          priceInput,
          wordLimitInput
        );
      });
  }

  /**
   * Fallback: Use hardcoded models if AJAX fails
   */
  function useFallbackModels(provider, selectElement) {
    const fallbackModels = {
      openai: [
        { value: "gpt-4o-mini", label: "GPT-4o Mini - Fast & Cost-Effective" },
        { value: "gpt-4-turbo", label: "GPT-4 Turbo - Very Smart" },
        { value: "gpt-4", label: "GPT-4 - Most Powerful" },
        { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo - Budget-Friendly" },
      ],
      gemini: [
        { value: "gemini-2.0-pro-exp", label: "Gemini 2.0 Pro Exp - Newest" },
        { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro - Balanced" },
        { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash - Fast & Cheap" },
        { value: "gemini-pro", label: "Gemini Pro - Standard" },
      ],
      claude: [
        {
          value: "claude-3-5-sonnet",
          label: "Claude 3.5 Sonnet - Best for long content",
        },
        { value: "claude-3-opus", label: "Claude 3 Opus - Most Powerful" },
        { value: "claude-3-sonnet", label: "Claude 3 Sonnet - Balanced" },
        { value: "claude-3-haiku", label: "Claude 3 Haiku - Fast & Cheap" },
      ],
      template: [{ value: "template", label: "Template - No AI (Free)" }],
    };

    const models = fallbackModels[provider] || fallbackModels["template"];

    selectElement.innerHTML = "";
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      selectElement.appendChild(option);
    });

    console.log("✅ Fallback models loaded for " + provider);
  }

  /**
   * Calculate and display max tokens based on price and selected model cost.
   */
  function updateTokenBudgetDisplay(
    providerSelect,
    modelSelect,
    priceInput,
    wordLimitInput
  ) {
    if (!providerSelect || !modelSelect || !priceInput) {
      return;
    }

    const containerId = "llm-budget-info";
    let infoBox = document.getElementById(containerId);
    if (!infoBox) {
      infoBox = document.createElement("div");
      infoBox.id = containerId;
      infoBox.style.marginTop = "6px";
      infoBox.style.padding = "10px";
      infoBox.style.border = "1px solid #99D5D9";
      infoBox.style.borderRadius = "6px";
      infoBox.style.backgroundColor = "#2B5298";
      infoBox.style.fontSize = "12px";
      infoBox.style.lineHeight = "1.4em";
      infoBox.style.position = "relative";
      // Place it right under the cost input row for visibility
      const parent =
        priceInput.closest(".form-row") ||
        priceInput.parentElement ||
        modelSelect.parentElement ||
        providerSelect.parentElement;
      if (parent && parent.parentElement) {
        parent.parentElement.insertBefore(infoBox, parent.nextSibling);
      } else if (parent) {
        parent.appendChild(infoBox);
      }
    }

    const provider = providerSelect.value;
    const model = modelSelect.value;
    const priceVal = parseFloat(priceInput.value || "0");
    const pricePerMillion = getPricePerMillion(provider, model);
    const wordLimit = wordLimitInput
      ? parseInt(wordLimitInput.value || "0", 10)
      : 0;
    // Simple approximation: 1 word ≈ 1.2 tokens (conservative)
    const tokensEstimate = wordLimit > 0 ? Math.ceil(wordLimit * 1.2) : null;

    if (!priceVal || priceVal <= 0) {
      infoBox.innerHTML = "💰 Enter a price per generation to see max tokens.";
      return;
    }

    if (pricePerMillion === 0) {
      infoBox.innerHTML =
        "📚 Template model selected: unlimited tokens (no cost).";
      return;
    }

    if (!pricePerMillion) {
      infoBox.innerHTML = `ℹ️ Price for model <strong>${model}</strong> is unknown. Using your price of $${priceVal.toFixed(
        2
      )} as-is.`;
      return;
    }

    const maxTokens = Math.floor((priceVal / pricePerMillion) * 1_000_000);
    const formattedTokens = formatTokens(maxTokens);

    let detailLines = [];
    detailLines.push(
      `💰 Budget: <strong>$${priceVal.toFixed(
        2
      )}</strong> · Model: <strong>${model}</strong> · Rate: $${pricePerMillion.toFixed(
        3
      )} per 1M tokens`
    );
    detailLines.push(
      `➡️ Max tokens from budget: <strong>${formattedTokens}</strong>`
    );

    if (tokensEstimate !== null) {
      const estCost = (tokensEstimate / 1_000_000) * pricePerMillion;
      const remaining = priceVal - estCost;
      const tokensDisplay = formatTokens(tokensEstimate);
      const costDisplay = `$${estCost.toFixed(4)}`;
      const remainingDisplay = `$${remaining.toFixed(4)}`;
      const status =
        remaining >= 0
          ? `✅ Fits budget. Remaining after script: <strong>${remainingDisplay}</strong>`
          : `⚠️ Over budget by <strong>$${Math.abs(remaining).toFixed(
              4
            )}</strong>. Lower word limit or increase budget.`;
      detailLines.push(
        `📝 Script word limit: <strong>${
          wordLimit || "n/a"
        }</strong> → est. tokens: <strong>${tokensDisplay}</strong> → est. cost: <strong>${costDisplay}</strong>`
      );
      detailLines.push(status);
    }

    infoBox.innerHTML = detailLines.join("<br>");
  }

  /**
   * Get price per million tokens for provider/model.
   */
  function getPricePerMillion(provider, model) {
    if (!provider || !model) return null;
    const providerCosts = COST_PER_MILLION[provider];
    if (!providerCosts) return null;
    // Direct match
    if (providerCosts[model] !== undefined) return providerCosts[model];

    // Try relaxed matching (starts with)
    const lowerModel = model.toLowerCase();
    const matchKey = Object.keys(providerCosts).find((key) =>
      lowerModel.startsWith(key.toLowerCase())
    );
    return matchKey ? providerCosts[matchKey] : null;
  }

  /**
   * Format tokens for display (e.g., 1.2M, 250k).
   */
  function formatTokens(count) {
    if (count >= 1_000_000) {
      return (count / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M tokens";
    }
    if (count >= 1_000) {
      return Math.round(count / 100) / 10 + "k tokens";
    }
    return count + " tokens";
  }

  /**
   * Get Django admin base URL
   */
  function getAdminBaseUrl() {
    // Look for Django's common patterns
    const currentPath = window.location.pathname;

    // Extract admin path (usually /admin/ or /administration-xxx/)
    const adminMatch = currentPath.match(
      /^(.*?\/(admin|administration[^\/]*)\/)/
    );
    if (adminMatch) {
      return adminMatch[1];
    }

    // Fallback
    return "/admin/";
  }

  /**
   * Show tooltip notification with consistent styling
   */
  function showTooltipNotification(tooltip) {
    // Remove old tooltip if exists
    const existingTooltip = document.querySelector(".llm-tooltip-notification");
    if (existingTooltip) {
      existingTooltip.remove();
    }

    // Create and show new tooltip with SAME BACKGROUND COLOR as info box
    const notification = document.createElement("div");
    notification.className = "llm-tooltip-notification";
    notification.innerHTML = `
            <div style="
                background-color: #2B5298;
                border: 1px solid #99D5D9;
                border-radius: 6px;
                padding: 10px;
                margin-top: 6px;
                font-size: 12px;
                line-height: 1.4em;
                color: #ffffff;
            ">
                <strong>💡 Info:</strong> ${tooltip}
            </div>
        `;

    // Find provider select and insert after it
    const providerSelect = document.querySelector(".llm-provider-select");
    if (providerSelect && providerSelect.parentNode) {
      providerSelect.parentNode.appendChild(notification);
    }
  }

  /**
   * Show error notification with consistent styling
   */
  function showErrorNotification(message) {
    const notification = document.createElement("div");
    notification.className = "llm-error-notification";
    notification.innerHTML = `
            <div style="
                background-color: #2B5298;
                border: 1px solid #ff6b6b;
                border-radius: 6px;
                padding: 10px;
                margin-top: 6px;
                font-size: 12px;
                line-height: 1.4em;
                color: #ffcccc;
            ">
                <strong>⚠️ Warning:</strong> ${message}
            </div>
        `;

    const providerSelect = document.querySelector(".llm-provider-select");
    if (providerSelect && providerSelect.parentNode) {
      providerSelect.parentNode.appendChild(notification);
    }
  }

  /**
   * Initialize field help text from database
   * Fetches help text for form fields dynamically
   */
  function initializeFieldHelpText() {
    // Detect model name from current page URL
    // Examples:
    // /admin/dailycast/teachercontentconfig/1/change/ → TeacherContentConfig
    // /admin/dailycast/usercategoryconfig/1/change/ → UserCategoryConfig
    // /administration-xxx/dailycast/teachercontentconfig/1/change/ → TeacherContentConfig
    const pathname = window.location.pathname;
    let modelName = 'TeacherContentConfig'; // default
    
    if (pathname.includes('teachercontentconfig')) {
      modelName = 'TeacherContentConfig';
    } else if (pathname.includes('usercategoryconfig')) {
      modelName = 'UserCategoryConfig';
    }
    
    console.log(`📄 Detected model: ${modelName}`);
    
    // List of fields to fetch help text for
    const fieldsToFetch = [
      'voice_map_json',
      'tts_fallback_chain',
      'bilingual_default_pair',
      'support_bilingual',
      'script_word_limit',
      'cooldown_hours',
      'max_generations_per_day',
    ];
    
    // Fetch help text for each field
    fieldsToFetch.forEach(fieldName => {
      const apiUrl = `/api/admin/ajax/field-help/?model=${encodeURIComponent(modelName)}&field=${encodeURIComponent(fieldName)}`;
      
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
          if (!data.error && data.help_text) {
            // Find the field element in the form
            const fieldElement = document.querySelector(`[name="${fieldName}"]`);
            if (fieldElement && fieldElement.parentElement) {
              // Check if help box already exists (avoid duplicates)
              const existingHelpBox = document.querySelector(`.field-help-text-${fieldName}`);
              if (!existingHelpBox) {
                // Create help text box with consistent styling
                const helpBox = document.createElement("div");
                helpBox.className = `field-help-text-${fieldName}`;
                helpBox.style.backgroundColor = "#2B5298";
                helpBox.style.border = "1px solid #99D5D9";
                helpBox.style.borderRadius = "6px";
                helpBox.style.padding = "8px";
                helpBox.style.marginTop = "4px";
                helpBox.style.fontSize = "11px";
                helpBox.style.lineHeight = "1.4em";
                helpBox.style.color = "#ffffff";
                helpBox.innerHTML = `📌 ${data.help_text}`;
                
                // Insert after the field
                fieldElement.parentElement.insertBefore(helpBox, fieldElement.nextSibling);
              }
            }
          }
        })
        .catch(error => {
          console.warn(`Could not fetch help text for ${fieldName}:`, error);
        });
    });
  }

  // Initialize field help text when page loads
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(() => {
      initializeFieldHelpText();
    }, 500);
  });

  /**
   * Voice map helper: fetch provider voices and update voice_map_json without manual typing
   */
  function initializeVoiceMapHelper() {
    const providerSelect = document.querySelector('select[name="default_tts_provider"]');
    const voiceMapInput = document.querySelector('textarea[name="voice_map_json"]');
    if (!providerSelect || !voiceMapInput) return;

    // Hide the textarea and its help text - user doesn't need to see JSON
    voiceMapInput.style.display = "none";
    const helpText = voiceMapInput.previousElementSibling;
    if (helpText && helpText.className && helpText.className.includes("help-text")) {
      helpText.style.display = "none";
    }

    // Build clean helper UI container
    const helperBox = document.createElement("div");
    helperBox.style.marginTop = "8px";
    helperBox.style.padding = "10px";
    helperBox.style.border = "1px solid #99D5D9";
    helperBox.style.borderRadius = "6px";
    helperBox.style.backgroundColor = "#2B5298";
    helperBox.style.color = "#ffffff";
    helperBox.style.fontSize = "12px";
    helperBox.style.lineHeight = "1.4em";

    // Language select (common set)
    const langSelect = document.createElement("select");
    langSelect.style.marginRight = "6px";
    langSelect.style.padding = "4px";
    langSelect.style.borderRadius = "3px";
    langSelect.style.border = "none";
    [
      { code: "en", label: "English (en)" },
      { code: "ja", label: "Japanese (ja)" },
      { code: "es", label: "Spanish (es)" },
      { code: "fr", label: "French (fr)" },
      { code: "de", label: "German (de)" },
      { code: "ko", label: "Korean (ko)" },
      { code: "zh", label: "Chinese (zh)" },
    ].forEach((lang) => {
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = lang.label;
      langSelect.appendChild(opt);
    });

    // Voice select (multi-select allowed)
    const voiceSelect = document.createElement("select");
    voiceSelect.style.marginTop = "8px";
    voiceSelect.style.marginBottom = "6px";
    voiceSelect.style.width = "100%";
    voiceSelect.style.padding = "4px";
    voiceSelect.style.borderRadius = "3px";
    voiceSelect.style.border = "1px solid #ccc";
    voiceSelect.size = 6;
    voiceSelect.multiple = true;

    // Status area
    const statusLine = document.createElement("div");
    statusLine.style.marginTop = "6px";
    statusLine.style.fontSize = "11px";
    statusLine.style.opacity = "0.8";

    // Load voices from API
    const loadVoices = () => {
      const provider = providerSelect.value || "elevenlabs";
      const lang = langSelect.value || "";
      const url = `/api/admin/ajax/tts-voices/?provider=${encodeURIComponent(provider)}&language=${encodeURIComponent(lang)}`;
      statusLine.textContent = `Loading...`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          voiceSelect.innerHTML = "";
          (data.voices || []).forEach((v) => {
            const opt = document.createElement("option");
            const gender = v.gender ? ` · ${v.gender}` : "";
            const accent = v.accent ? ` · ${v.accent}` : "";
            opt.value = v.voice_id;
            opt.textContent = `${v.name || v.voice_id}${gender}${accent}`;
            voiceSelect.appendChild(opt);
          });
          statusLine.textContent = `${data.count || voiceSelect.options.length} voices available`;
        })
        .catch((err) => {
          console.error("Voice load failed", err);
          statusLine.textContent = "Could not load voices";
        });
    };

    // Add mapping to textarea
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "Add";
    addButton.style.marginLeft = "6px";
    addButton.style.padding = "4px 12px";
    addButton.style.borderRadius = "3px";
    addButton.style.backgroundColor = "#1e3a5f";
    addButton.style.color = "#ffffff";
    addButton.style.border = "none";
    addButton.style.cursor = "pointer";
    addButton.onclick = () => {
      const lang = langSelect.value;
      const selections = Array.from(voiceSelect.selectedOptions).map((o) => o.value);
      if (!lang || selections.length === 0) {
        statusLine.textContent = "Select language and voice(s)";
        return;
      }
      try {
        const current = voiceMapInput.value.trim() ? JSON.parse(voiceMapInput.value) : {};
        current[lang] = selections.length === 1 ? selections[0] : selections;
        voiceMapInput.value = JSON.stringify(current, null, 2);
        voiceMapInput.dispatchEvent(new Event("input", { bubbles: true }));
        statusLine.textContent = `✓ Saved: ${lang} mapped`;
      } catch (e) {
        statusLine.textContent = "Error saving";
      }
    };

    // Controls row
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "6px";
    controls.style.alignItems = "center";
    controls.style.marginBottom = "8px";
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "Load voices";
    loadButton.style.padding = "4px 12px";
    loadButton.style.borderRadius = "3px";
    loadButton.style.backgroundColor = "#1e3a5f";
    loadButton.style.color = "#ffffff";
    loadButton.style.border = "none";
    loadButton.style.cursor = "pointer";
    loadButton.onclick = loadVoices;
    controls.appendChild(langSelect);
    controls.appendChild(loadButton);
    controls.appendChild(addButton);

    helperBox.appendChild(controls);
    helperBox.appendChild(voiceSelect);
    helperBox.appendChild(statusLine);

    // Insert helper after the hidden voice_map_json field
    const parent = voiceMapInput.parentElement;
    if (parent) {
      parent.insertBefore(helperBox, voiceMapInput.nextSibling);
    }

    // Auto-load once on init
    loadVoices();

    // Reload voices when provider changes
    providerSelect.addEventListener("change", loadVoices);
  }

  // Initialize voice helper
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(() => {
      initializeVoiceMapHelper();
    }, 600);
  });

})();

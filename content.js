// content.js
(() => {
  if (window.accessMateInjected) return;
  window.accessMateInjected = true;

  let root = null;
  let lensPopup = null;
  let isScanning = false;
  let issues = [];
  let smartLensActive = false;
  let voiceActive = false;
  let focusModeActive = false;
  let highlightsVisible = false;
  let currentHighlightedIssue = null;
  
  // Speech Setup
  const synth = window.speechSynthesis;
  let recognition = null;
  
  if ('webkitSpeechRecognition' in window) {
    // eslint-disable-next-line no-undef
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = false;
  }

  // Icons
  const Icons = {
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z"></path></svg>',
    mic: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>',
    power: '<svg viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"></path></svg>',
    lens: '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"></path></svg>',
    font: '<svg viewBox="0 0 24 24"><path d="M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3V9H3v3z"></path></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"></path></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>'
  };

  chrome.runtime.onMessage.addListener((msg) => {
    try {
      if (msg.action === "TOGGLE_SCAN") {
        if (!root) initUI();
        toggleUI();
      }
    } catch (e) {
      console.error('[AccessMate] Error handling message:', e);
    }
  });

  function toggleUI() {
    if (!root) return;
    root.classList.toggle('am-visible');
  }

  function initUI() {
    root = document.createElement('div');
    root.id = 'accessmate-root';
    
    root.innerHTML = `
      <div class="am-sidebar">
        <div class="am-nav-item active" title="Scan">${Icons.shield}</div>
        <div class="am-nav-item" id="am-mic-btn" title="Voice Assistant">${Icons.mic}</div>
      </div>
      
      <div class="am-main">
        <div class="am-content-view">
          <div class="am-header">
            <div class="am-logo">⚡ AccessMate</div>
            <button class="am-close">✕</button>
          </div>

          <div class="am-power-container">
            <div class="am-power-btn" id="am-power-btn">
               <div class="am-power-icon">${Icons.power}</div>
               <div class="am-status-icon" id="am-status-icon">${Icons.check}</div>
            </div>
            <div class="am-status" id="am-status">Tap to Audit Page</div>
          </div>

          <div class="am-toggles">
             <div class="am-toggle-row">
                <div class="am-toggle-info">
                   <div class="am-toggle-icon">${Icons.lens}</div>
                   <span class="am-toggle-label">Smart Lens (Hover)</span>
                </div>
                <div class="am-switch" id="toggle-lens"></div>
             </div>
             
             <div class="am-toggle-row">
                <div class="am-toggle-info">
                   <div class="am-toggle-icon">${Icons.eye}</div>
                   <span class="am-toggle-label">Focus Mode</span>
                </div>
                <div class="am-switch" id="toggle-focus"></div>
             </div>

             <div class="am-toggle-row">
                <div class="am-toggle-info">
                   <div class="am-toggle-icon">${Icons.font}</div>
                   <span class="am-toggle-label">Dyslexia Font</span>
                </div>
                <div class="am-switch" id="toggle-dyslexia"></div>
             </div>
          </div>

          <div class="am-bottom-card">
             <div class="am-loc-text">
                <h4>Analysis Report</h4>
                <p id="am-issue-count">No Scan Yet</p>
             </div>
             <button class="am-btn-details" id="am-details-btn">Details</button>
          </div>
        </div>

        <div class="am-details-panel">
           <div class="am-details-header">
              <button class="am-back-btn">${Icons.arrowLeft}</button>
              <div class="am-details-title">Accessibility Issues</div>
           </div>
           <div class="am-issue-list" id="am-issue-list">
              <!-- Issues injected here -->
           </div>
        </div>

        <div class="am-chat-overlay" id="am-chat-overlay">
           <span class="am-chat-listening">Listening...</span>
           <div class="am-chat-text" id="am-chat-text">Ask a question about this page.</div>
        </div>
      </div>
    `;

    // Lens Popup Container
    lensPopup = document.createElement('div');
    lensPopup.id = 'am-smart-lens-popup';
    document.body.appendChild(lensPopup);

    document.body.appendChild(root);
    setupEvents();
  }

  function setupEvents() {
    root.querySelector('.am-close').onclick = () => {
      toggleUI();
      clearAllHighlights();
    };
    root.querySelector('#am-power-btn').onclick = startAudit;
    
    const mainContainer = root.querySelector('.am-main');
    root.querySelector('#am-details-btn').onclick = () => {
        mainContainer.classList.add('am-slide-active');
        // If issues exist but list is empty, repopulate
        if(issues.length > 0 && root.querySelector('#am-issue-list').children.length === 0) {
            populateDetails();
        }
        // Show all issue highlights on page
        showAllHighlights();
    };
    root.querySelector('.am-back-btn').onclick = () => {
        mainContainer.classList.remove('am-slide-active');
        // Keep highlights but remove focus
        if (currentHighlightedIssue) {
            currentHighlightedIssue.classList.remove('am-issue-focused');
            currentHighlightedIssue = null;
        }
    };

    // Toggles
    bindToggle('#toggle-dyslexia', () => document.body.classList.toggle('am-dyslexia-mode'));
    bindToggle('#toggle-focus', () => {
        focusModeActive = !focusModeActive;
        document.body.classList.toggle('am-focus-mode');
        // When focus mode is enabled and we have issues, highlight them
        if (focusModeActive && issues.length > 0) {
            showAllHighlights();
        }
    });
    bindToggle('#toggle-lens', () => { 
      smartLensActive = !smartLensActive;
      if(smartLensActive) enableSmartLens();
      else disableSmartLens();
    });

    // Voice
    root.querySelector('#am-mic-btn').onclick = toggleVoiceAssistant;
  }

  function bindToggle(id, callback) {
    const el = root.querySelector(id);
    el.onclick = () => {
      el.classList.toggle('checked');
      callback();
    };
  }

  // --- Scan Logic ---
  function startAudit() {
    if (isScanning) return;
    isScanning = true;
    
    const btn = root.querySelector('#am-power-btn');
    btn.classList.add('scanning');
    btn.className = 'am-power-btn scanning'; 
    root.querySelector('#am-status').innerText = 'AI Scanning...';

    setTimeout(() => {
       scanIssues();
       isScanning = false;
       btn.classList.remove('scanning');
       btn.classList.add('active');
       
       updateScoreVisuals();
       populateDetails();
    }, 1500);
  }

  function updateScoreVisuals() {
       const btn = root.querySelector('#am-power-btn');
       const fixedCount = document.querySelectorAll('.am-issue-item.fixed').length;
       const count = issues.length - fixedCount;
       let colorClass = 'score-pink';
       let statusText = 'PERFECT!';
       let icon = Icons.heart;

       if (count > 0) { colorClass = 'score-green'; statusText = 'GOOD'; icon = Icons.check; }
       if (count > 20) { colorClass = 'score-yellow'; statusText = 'MODERATE'; icon = Icons.warn; }
       if (count > 50) { colorClass = 'score-red'; statusText = 'NEEDS WORK'; icon = Icons.warn; }
       
       btn.classList.remove('score-pink', 'score-green', 'score-yellow', 'score-red');
       btn.classList.add(colorClass);
       
       root.querySelector('#am-status').innerText = statusText;
       root.querySelector('#am-status-icon').innerHTML = icon;
       
       if (fixedCount > 0 && count === 0) {
           root.querySelector('#am-issue-count').innerText = "All Fixed! 🎉";
       } else if (fixedCount > 0) {
           root.querySelector('#am-issue-count').innerText = `${count} Issues (${fixedCount} Fixed)`;
       } else {
           root.querySelector('#am-issue-count').innerText = count === 0 ? "No Issues Found" : `${count} Issues Found`;
       }
  }

  function scanIssues() {
     issues = [];
     clearAllHighlights();
     
     // 1. Image Alts - Missing or inadequate
     document.querySelectorAll('img').forEach((el) => {
        if (!el.alt || el.alt.trim().length < 3) {
            issues.push({ el, type: 'Missing Alt Text', desc: 'Image needs a descriptive alt attribute for screen readers.', severity: 'high' });
        }
     });

     // 2. Empty Links/Buttons - No accessible text
     document.querySelectorAll('button, a, [role="button"]').forEach((el) => {
        const text = (el.innerText || '').trim();
        const ariaLabel = el.getAttribute('aria-label') || '';
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const title = el.getAttribute('title') || '';
        
        if (text.length === 0 && ariaLabel.length === 0 && !ariaLabelledBy && title.length === 0) {
            // Check for img inside
            const hasImg = el.querySelector('img[alt]');
            if (!hasImg) {
                issues.push({ el, type: 'Empty Interactive Element', desc: 'Button or link has no accessible label.', severity: 'high' });
            }
        }
     });

     // 3. Form inputs without labels
     document.querySelectorAll('input, select, textarea').forEach((el) => {
        if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return;
        
        const id = el.id;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const placeholder = el.getAttribute('placeholder');
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        
        if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
            issues.push({ el, type: 'Missing Form Label', desc: placeholder ? 'Input uses placeholder instead of proper label.' : 'Form input has no associated label.', severity: 'high' });
        }
     });

     // 4. Missing lang attribute on html
     const html = document.documentElement;
     if (!html.getAttribute('lang')) {
        issues.push({ el: html, type: 'Missing Language', desc: 'Page is missing lang attribute on <html> element.', severity: 'medium' });
     }

     // 5. Low contrast text (improved detection)
     document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, li, td, th, label, a').forEach((el) => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        
        // Parse RGB values
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            // Light gray text detection
            if (r > 180 && g > 180 && b > 180 && r === g && g === b) {
                issues.push({ el, type: 'Low Contrast Text', desc: 'Text color may be hard to read.', severity: 'medium' });
            }
        }
     });

     // 6. Missing skip links
     const skipLink = document.querySelector('a[href="#main"], a[href="#content"], .skip-link, [class*="skip"]');
     if (!skipLink) {
        issues.push({ el: document.body, type: 'Missing Skip Link', desc: 'Page lacks a skip navigation link.', severity: 'low' });
     }

     // 7. Auto-playing media
     document.querySelectorAll('video, audio').forEach((el) => {
        if (el.autoplay && !el.muted) {
            issues.push({ el, type: 'Auto-playing Media', desc: 'Media auto-plays with sound, which can be disorienting.', severity: 'medium' });
        }
     });

     // 8. Missing heading structure
     const h1s = document.querySelectorAll('h1');
     if (h1s.length === 0) {
        issues.push({ el: document.body, type: 'Missing H1', desc: 'Page has no main heading (H1).', severity: 'medium' });
     } else if (h1s.length > 1) {
        issues.push({ el: h1s[1], type: 'Multiple H1 Tags', desc: 'Page has multiple H1 headings.', severity: 'low' });
     }

     // 9. Links that open in new tab without warning
     document.querySelectorAll('a[target="_blank"]').forEach((el) => {
        const text = (el.innerText || '').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        if (!text.includes('new') && !text.includes('tab') && !text.includes('window') &&
            !ariaLabel.includes('new') && !ariaLabel.includes('tab')) {
            issues.push({ el, type: 'External Link Warning', desc: 'Link opens in new tab without indicating this to users.', severity: 'low' });
        }
     });

     // 10. Tables without headers
     document.querySelectorAll('table').forEach((el) => {
        const hasHeaders = el.querySelector('th');
        if (!hasHeaders) {
            issues.push({ el, type: 'Table Missing Headers', desc: 'Data table lacks header cells.', severity: 'medium' });
        }
     });

     // 11. iframes without title
     document.querySelectorAll('iframe').forEach((el) => {
        if (!el.title || el.title.trim().length === 0) {
            issues.push({ el, type: 'iFrame Missing Title', desc: 'Embedded content lacks a descriptive title.', severity: 'medium' });
        }
     });

     // 12. Elements with onclick but not keyboard accessible
     document.querySelectorAll('[onclick]').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (tag !== 'a' && tag !== 'button' && tag !== 'input') {
            const tabindex = el.getAttribute('tabindex');
            const role = el.getAttribute('role');
            if (!tabindex && !role) {
                issues.push({ el, type: 'Non-keyboard Accessible', desc: 'Clickable element not accessible via keyboard.', severity: 'high' });
            }
        }
     });
  }

  // --- Highlight Functions ---
  function showAllHighlights() {
    highlightsVisible = true;
    issues.forEach((issue, index) => {
        if (!issue.el || !document.body.contains(issue.el)) return;
        
        // Add highlight overlay
        issue.el.classList.add('am-issue-highlight');
        issue.el.setAttribute('data-am-issue-index', index);
        
        // Add severity class
        if (issue.severity === 'high') {
            issue.el.classList.add('am-highlight-high');
        } else if (issue.severity === 'medium') {
            issue.el.classList.add('am-highlight-medium');
        } else {
            issue.el.classList.add('am-highlight-low');
        }
        
        // Create floating badge
        createIssueBadge(issue, index);
    });
  }

  function createIssueBadge(issue, index) {
    // Remove existing badge if any
    const existingBadge = document.querySelector(`[data-am-badge-index="${index}"]`);
    if (existingBadge) existingBadge.remove();
    
    const badge = document.createElement('div');
    badge.className = 'am-issue-badge';
    badge.setAttribute('data-am-badge-index', index);
    badge.innerHTML = `<span class="am-badge-num">${index + 1}</span>`;
    badge.title = `${issue.type}: ${issue.desc}`;
    
    // Position badge
    if (issue.el && document.body.contains(issue.el)) {
        const rect = issue.el.getBoundingClientRect();
        badge.style.position = 'fixed';
        badge.style.left = `${rect.left - 10}px`;
        badge.style.top = `${rect.top - 10}px`;
        badge.style.zIndex = '2147483645';
        
        // Click to focus on issue in panel
        badge.onclick = (e) => {
            e.stopPropagation();
            focusIssueInPanel(index);
        };
        
        document.body.appendChild(badge);
    }
  }

  function focusIssueInPanel(index) {
    const issueItems = root.querySelectorAll('.am-issue-item');
    if (issueItems[index]) {
        // Scroll panel to issue
        issueItems[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        issueItems[index].classList.add('am-issue-pulse');
        setTimeout(() => issueItems[index].classList.remove('am-issue-pulse'), 1000);
    }
  }

  function clearAllHighlights() {
    highlightsVisible = false;
    
    // Remove highlight classes
    document.querySelectorAll('.am-issue-highlight').forEach(el => {
        el.classList.remove('am-issue-highlight', 'am-highlight-high', 'am-highlight-medium', 'am-highlight-low', 'am-issue-focused');
        el.removeAttribute('data-am-issue-index');
    });
    
    // Remove badges
    document.querySelectorAll('.am-issue-badge').forEach(el => el.remove());
    
    // Remove fix overlays
    document.querySelectorAll('.am-fix-overlay').forEach(el => el.remove());
    
    currentHighlightedIssue = null;
  }

  function highlightSingleIssue(issue, index) {
    // Remove previous focus
    if (currentHighlightedIssue) {
        currentHighlightedIssue.classList.remove('am-issue-focused');
    }
    
    if (issue.el && document.body.contains(issue.el)) {
        currentHighlightedIssue = issue.el;
        issue.el.classList.add('am-issue-focused');
        issue.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function populateDetails() {
    const list = root.querySelector('#am-issue-list');
    list.innerHTML = '';
    
    if (issues.length === 0) {
       list.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">No issues found. Great job!</div>';
       return;
    }

    // Add "Fix All" button at top
    const fixAllBtn = document.createElement('button');
    fixAllBtn.className = 'am-fix-all-btn';
    fixAllBtn.innerHTML = '🔧 Fix All Issues with AI';
    fixAllBtn.onclick = () => fixAllIssues();
    list.appendChild(fixAllBtn);

    issues.forEach((issue, index) => {
       const item = document.createElement('div');
       item.className = `am-issue-item severity-${issue.severity}`;
       item.setAttribute('data-issue-index', index);
       item.innerHTML = `
         <div class="am-issue-number">#${index + 1}</div>
         <h5>${issue.type}</h5>
         <p>${issue.desc}</p>
         <div class="am-issue-actions">
            <button class="am-btn-locate" title="Locate on page">📍 Locate</button>
            <button class="am-btn-fix" title="Fix with AI">🔧 Fix</button>
         </div>
         <div class="status-badge">Pending</div>
       `;
       
       // Locate button - scroll and highlight
       item.querySelector('.am-btn-locate').onclick = (e) => {
           e.stopPropagation();
           highlightSingleIssue(issue, index);
       };
       
       // Fix button - AI fix
       item.querySelector('.am-btn-fix').onclick = (e) => {
           e.stopPropagation();
           fixSingleIssue(issue, item, index);
       };
       
       // Click on item to locate
       item.onclick = () => {
           highlightSingleIssue(issue, index);
       };
       
       list.appendChild(item);
    });
  }

  function fixSingleIssue(issue, item, index) {
    if(item.classList.contains('fixed') || item.classList.contains('fixing')) return;

    // Visual: Fixing
    item.classList.add('fixing');
    item.querySelector('.status-badge').innerText = "AI Fixing...";
    highlightSingleIssue(issue, index);
    
    // Add loading overlay on element
    showFixingOverlay(issue.el);
    
    // Fix Request
    chrome.runtime.sendMessage({
       action: "ANALYZE_ELEMENT",
       html: issue.el.outerHTML,
       issueType: issue.type
    }, (res) => {
       removeFixingOverlay(issue.el);
       
       if (chrome.runtime.lastError) {
           console.error('[AccessMate]', chrome.runtime.lastError.message);
           item.classList.remove('fixing');
           item.querySelector('.status-badge').innerText = "Error - Retry";
           return;
       }
       
       if(res && res.result) {
          try {
              // Parse the fix result
              let fixData = res.result;
              if (typeof fixData === 'string') {
                  fixData = JSON.parse(fixData);
              }
              
              if (fixData.fixedHtml) {
                  // Apply the fix to the actual element
                  applyFix(issue.el, fixData.fixedHtml, issue.type);
              }
              
              // Visual: Fixed
              item.classList.remove('fixing');
              item.classList.add('fixed');
              item.querySelector('.status-badge').innerText = "✓ Fixed!";
              
              // Remove highlight from element
              issue.el.classList.remove('am-issue-highlight', 'am-highlight-high', 'am-highlight-medium', 'am-highlight-low', 'am-issue-focused');
              issue.el.classList.add('am-issue-fixed');
              
              // Remove badge
              const badge = document.querySelector(`[data-am-badge-index="${index}"]`);
              if (badge) badge.remove();
              
              // Update count
              setTimeout(() => {
                  const fixedCount = document.querySelectorAll('.am-issue-item.fixed').length;
                  const remainingCount = issues.length - fixedCount;
                  root.querySelector('#am-issue-count').innerText = 
                      remainingCount === 0 ? "All Fixed! 🎉" : `${remainingCount} Issues Remaining`;
                  updateScoreVisuals();
              }, 500);
              
          } catch (e) {
              console.error('[AccessMate] Parse error:', e);
              item.classList.remove('fixing');
              item.querySelector('.status-badge').innerText = "Fixed (manual check)";
              item.classList.add('fixed');
          }
       } else {
          item.classList.remove('fixing');
          item.querySelector('.status-badge').innerText = "Retry";
       }
    });
  }

  function applyFix(el, fixedHtml, issueType) {
    try {
        // Create a temporary container to parse the fixed HTML
        const temp = document.createElement('div');
        temp.innerHTML = fixedHtml;
        const fixedEl = temp.firstElementChild;
        
        if (!fixedEl) return;
        
        // Apply specific fixes based on issue type
        if (issueType === 'Missing Alt Text' && el.tagName === 'IMG') {
            el.alt = fixedEl.alt || fixedEl.getAttribute('alt') || 'Descriptive image';
        } else if (issueType === 'Empty Interactive Element') {
            const newLabel = fixedEl.getAttribute('aria-label') || fixedEl.innerText;
            if (newLabel) el.setAttribute('aria-label', newLabel);
        } else if (issueType === 'Missing Form Label') {
            el.setAttribute('aria-label', fixedEl.getAttribute('aria-label') || el.placeholder || 'Input field');
        } else if (issueType === 'iFrame Missing Title') {
            el.title = fixedEl.title || 'Embedded content';
        } else if (issueType === 'Non-keyboard Accessible') {
            el.setAttribute('tabindex', '0');
            el.setAttribute('role', 'button');
        } else if (issueType === 'External Link Warning') {
            const currentText = el.innerText;
            if (!currentText.includes('(opens')) {
                el.setAttribute('aria-label', `${currentText} (opens in new tab)`);
            }
        }
        
        // Add visual success indicator
        el.style.transition = 'all 0.3s';
        el.style.outline = '3px solid #22c55e';
        setTimeout(() => {
            el.style.outline = '';
        }, 2000);
        
    } catch (e) {
        console.error('[AccessMate] Apply fix error:', e);
    }
  }

  async function fixAllIssues() {
    const unfixedItems = root.querySelectorAll('.am-issue-item:not(.fixed):not(.fixing)');
    const btn = root.querySelector('.am-fix-all-btn');
    
    if (unfixedItems.length === 0) return;
    
    btn.disabled = true;
    btn.innerText = '⏳ Fixing all issues...';
    
    for (let i = 0; i < unfixedItems.length; i++) {
        const item = unfixedItems[i];
        const index = parseInt(item.getAttribute('data-issue-index'));
        const issue = issues[index];
        
        if (issue) {
            await new Promise(resolve => {
                fixSingleIssue(issue, item, index);
                // Wait a bit between fixes to avoid overwhelming the API
                setTimeout(resolve, 800);
            });
        }
    }
    
    btn.innerText = '✅ All Done!';
    btn.disabled = false;
  }

  function showFixingOverlay(el) {
    if (!el || !document.body.contains(el)) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'am-fix-overlay';
    overlay.innerHTML = '<div class="am-fix-spinner"></div><span>AI Fixing...</span>';
    
    const rect = el.getBoundingClientRect();
    overlay.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${Math.max(rect.width, 100)}px;
        height: ${Math.max(rect.height, 40)}px;
        z-index: 2147483646;
    `;
    
    el.setAttribute('data-am-fixing', 'true');
    document.body.appendChild(overlay);
  }

  function removeFixingOverlay(el) {
    if (!el) return;
    el.removeAttribute('data-am-fixing');
    const overlays = document.querySelectorAll('.am-fix-overlay');
    overlays.forEach(o => o.remove());
  }

  // --- Smart Lens (Interactive) ---
  function enableSmartLens() { document.addEventListener('mouseover', handleSmartHover, true); }
  function disableSmartLens() { 
      document.removeEventListener('mouseover', handleSmartHover, true); 
      hideLensPopup();
  }

  function handleSmartHover(e) {
    if(e.target.tagName !== 'IMG') return;
    showLensPopup(e.target, e.pageX, e.pageY);
  }

  function showLensPopup(img, x, y) {
     if(!lensPopup) return;
     lensPopup.style.left = x + 'px';
     lensPopup.style.top = y + 'px';
     lensPopup.classList.add('visible');
     
     // Initial Buttons
     lensPopup.innerHTML = `
       <button class="am-lens-btn" id="am-lens-text">
         ${Icons.font} Text
       </button>
       <button class="am-lens-btn" id="am-lens-voice">
         ${Icons.mic} Voice
       </button>
     `;

     document.getElementById('am-lens-text').onclick = (e) => {
        e.stopPropagation();
        runLensAnalysis(img, 'text');
     };
     document.getElementById('am-lens-voice').onclick = (e) => {
        e.stopPropagation();
        runLensAnalysis(img, 'voice');
     };
  }

  function hideLensPopup() {
     if(lensPopup) lensPopup.classList.remove('visible');
  }

  async function runLensAnalysis(img, mode) {
     if (!lensPopup || !img) return;
     lensPopup.innerHTML = '<div style="color:white; padding:8px; font-size:12px;">Analyzing...</div>';
     
     const originalFilter = img.style.filter;
     img.style.filter = "brightness(0.8) sepia(1)";
     
     try {
       chrome.runtime.sendMessage({ action: "DESCRIBE_IMAGE", src: img.src }, (res) => {
         img.style.filter = originalFilter;
         if (chrome.runtime.lastError) {
           console.error('[AccessMate]', chrome.runtime.lastError.message);
           hideLensPopup();
           return;
         }
         if(res && res.description) {
            if(mode === 'text') {
               lensPopup.innerHTML = `<div class="am-lens-result">${res.description}</div>`;
               setTimeout(hideLensPopup, 5000);
            } else {
               speak(res.description);
               hideLensPopup();
            }
         } else {
            hideLensPopup();
         }
       });
     } catch (e) {
       img.style.filter = originalFilter;
       console.error('[AccessMate] Lens analysis error:', e);
       hideLensPopup();
     }
  }

  // --- Voice Assistant ---
  function toggleVoiceAssistant() {
    if(!recognition) { alert("Browser not supported"); return; }
    
    voiceActive = !voiceActive;
    const btn = root.querySelector('#am-mic-btn');
    const overlay = root.querySelector('#am-chat-overlay');
    let silenceTimeout = null;
    
    if(voiceActive) {
       btn.classList.add('mic-active');
       overlay.classList.add('active');
       recognition.start();
       
       silenceTimeout = setTimeout(() => {
          if(voiceActive) {
             toggleVoiceAssistant(); 
             speak("I stopped listening due to silence.");
          }
       }, 10000);

       recognition.onresult = (event) => {
         clearTimeout(silenceTimeout);
         const question = event.results[0][0].transcript;
         root.querySelector('#am-chat-text').innerText = question;
         handleVoiceQuery(question);
         toggleVoiceAssistant();
       };
    } else {
       btn.classList.remove('mic-active');
       overlay.classList.remove('active');
       recognition.stop();
       synth.cancel();
    }
  }

  function handleVoiceQuery(question) {
    try {
      const context = document.body.innerText.substring(0, 3000);
      chrome.runtime.sendMessage({
         action: "ASK_PAGE",
         question: question,
         context: context
      }, (res) => {
         if (chrome.runtime.lastError) {
           console.error('[AccessMate]', chrome.runtime.lastError.message);
           speak("Sorry, I couldn't process that request.");
           return;
         }
         if (res && res.answer) {
           speak(res.answer);
         } else {
           speak("Sorry, I couldn't get an answer.");
         }
      });
    } catch (e) {
      console.error('[AccessMate] Voice query error:', e);
      speak("An error occurred.");
    }
  }

  function speak(text) {
     synth.cancel();
     const u = new SpeechSynthesisUtterance(text);
     synth.speak(u);
  }

})();

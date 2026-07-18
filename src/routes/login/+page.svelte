<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicOut, quintOut, elasticOut } from 'svelte/easing';
  import { Receipt, ChefHat, Boxes, CornerUpLeft, Check } from '@lucide/svelte';
  import logoImg from '../../assets/catersync.png';

  // ── Reduced-motion guard ──────────────────────────────────────────────────
  const reduceMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  function dur(ms) { return reduceMotion ? 1 : ms; }
  function dly(ms) { return reduceMotion ? 0 : ms; }

  const appState = getCateringContext();

  // ── View state ──────────────────────────────────────────────────────────────
  let view = $state('login');
  let loginStep = $state('identifier');
  let signupStep = $state('role');
  let signupRole = $state(null);

  // ── Step direction tracking logic ──────────────────────────────────────────
  const LOGIN_STEPS = ['identifier', 'otp', 'profile'];
  let prevLoginStep = 'identifier';
  let loginDirection = $state('forward');

  $effect(() => {
    const prevIdx = LOGIN_STEPS.indexOf(prevLoginStep);
    const currIdx = LOGIN_STEPS.indexOf(loginStep);
    if (currIdx > prevIdx) {
      loginDirection = 'forward';
    } else if (currIdx < prevIdx) {
      loginDirection = 'backward';
    }
    prevLoginStep = loginStep;
  });

  const SIGNUP_STEPS = ['role', 'form', 'otp', 'profile'];
  let prevSignupStep = 'role';
  let signupDirection = $state('forward');

  $effect(() => {
    const prevIdx = SIGNUP_STEPS.indexOf(prevSignupStep);
    const currIdx = SIGNUP_STEPS.indexOf(signupStep);
    if (currIdx > prevIdx) {
      signupDirection = 'forward';
    } else if (currIdx < prevIdx) {
      signupDirection = 'backward';
    }
    prevSignupStep = signupStep;
  });

  const flyInX = (dir) => (dir === 'forward' ? -120 : 120);
  const flyOutX = (dir) => (dir === 'forward' ? 120 : -120);

  // ── Shared fields ───────────────────────────────────────────────────────────
  let identifier   = $state('');
  let otpCode      = $state('');
  let debugOtp     = $state('');
  let resolvedType = $state(null);

  let suFullName = $state('');
  let suPhone    = $state('');
  let suEmail    = $state('');
  let suCompany  = $state('');
  let suCategory = $state('');
  let suPosition = $state('');

  let profName     = $state('');
  let profPhone    = $state('');
  let profAddress  = $state('');
  let profBirthday = $state('');
  let profAllergies = $state([]);
  let profDietary   = $state([]);

  const ALLERGY_OPTIONS = ['Nuts', 'Seafood', 'Dairy', 'Eggs', 'Gluten', 'Soy', 'Shellfish'];
  const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free', 'Keto', 'Low-Sodium'];

  function toggleChip(arr, val) {
    const idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
  }

  // ── UI state ────────────────────────────────────────────────────────────────
  let isLoading    = $state(false);
  let errorMsg     = $state('');
  let successMsg   = $state('');
  let showGreeting = $state(false);
  let greetingMsg  = $state('');
  let googleClientId = $state('');

  let timerSecs   = $state(600);
  let timerHandle = null;

  function startCountdown() {
    clearInterval(timerHandle);
    timerSecs = 600;
    timerHandle = setInterval(() => {
      if (timerSecs > 0) { timerSecs--; }
      else { clearInterval(timerHandle); errorMsg = 'Verification code expired. Please go back and request a new one.'; }
    }, 1000);
  }

  onDestroy(() => clearInterval(timerHandle));

  function fmtTimer(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function getGreeting(name) {
    const h = new Date().getHours();
    const n = name?.split(' ')[0] || 'there';
    if (h >= 5 && h < 12) return `Good morning, ${n}! ☀️`;
    if (h >= 12 && h < 17) return `Good afternoon, ${n}! 🌤️`;
    if (h >= 17 && h < 21) return `Good evening, ${n}! 🌇`;
    return `Welcome back, ${n}! 🌙`;
  }

  function redirect(type, name) {
    appState.playStampSound?.();
    greetingMsg  = getGreeting(name);
    showGreeting = true;
    setTimeout(() => {
      appState.isAuthenticated = true;
      if (type === 'subscriber') goto('/portal');
      else if (type === 'supplier') goto('/supplier');
      else goto('/');
    }, 1800);
  }

  function clearMessages() { errorMsg = ''; successMsg = ''; }

  // ── Google SSO ──────────────────────────────────────────────────────────────
  function loadGoogleScript(buttonId, callback) {
    const existing = document.getElementById('google-gsi-client');
    if (existing && window.google) { renderGoogleButton(buttonId, callback); return; }
    if (!existing) {
      const s = document.createElement('script');
      s.id = 'google-gsi-client';
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => renderGoogleButton(buttonId, callback);
      document.head.appendChild(s);
    } else { existing.addEventListener('load', () => renderGoogleButton(buttonId, callback)); }
  }

  function renderGoogleButton(buttonId, callback) {
    if (!window.google || !googleClientId) return;
    try {
      window.google.accounts.id.initialize({ client_id: googleClientId, callback, auto_select: false, cancel_on_tap_outside: true });
      const el = document.getElementById(buttonId);
      if (el) window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: el.offsetWidth || 340, text: view === 'signup' ? 'signup_with' : 'signin_with' });
    } catch (err) { console.error('Google button render error:', err); }
  }

  $effect(() => {
    if (!googleClientId) return;
    const id = view === 'login' && loginStep === 'identifier' ? 'google-btn-login'
      : view === 'signup' && signupStep === 'form' ? 'google-btn-signup' : null;
    if (!id) return;
    setTimeout(() => loadGoogleScript(id, view === 'login' ? handleGoogleLogin : handleGoogleSignup), 80);
  });

  // ── LOGIN FLOW ──────────────────────────────────────────────────────────────
  async function submitIdentifier(e) {
    if (e) e.preventDefault();
    const email = identifier.trim();
    if (!email) return;
    clearMessages(); isLoading = true;
    try {
      let resolvedAccountType = null;
      try {
        const rr = await fetch('/api/auth/resolve-identity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email }) });
        if (rr.ok) {
          const rd = await rr.json();
          if (rd.success && rd.accountType) resolvedAccountType = rd.accountType;
          else if (rd.notFound) { isLoading = false; errorMsg = 'No account found for this email. Use Sign Up below to create one.'; return; }
        }
      } catch { /* endpoint not built yet — fall through */ }

      const accountType = resolvedAccountType || 'subscriber';
      const otpRes = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, accountType }) });
      const otpData = await otpRes.json();
      if (otpData.success) {
        debugOtp = otpData.otpCode || ''; resolvedType = accountType;
        successMsg = `Verification code sent to ${email}`; loginStep = 'otp'; startCountdown();
        setTimeout(() => successMsg = '', 4000);
      } else { appState.playBuzzerSound?.(); errorMsg = otpData.error || 'Could not send verification code.'; }
    } catch (err) { appState.playBuzzerSound?.(); errorMsg = 'Connection error: ' + err.message; }
    finally { isLoading = false; }
  }

  async function verifyLoginOtp(e) {
    if (e) e.preventDefault();
    const code = otpCode.trim();
    if (code.length !== 6 || timerSecs <= 0) return;
    clearMessages(); isLoading = true;
    try {
      const accountType = resolvedType || 'subscriber';
      const res = await fetch('/api/auth/verify-email-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: identifier.trim(), otp: code, accountType }) });
      const data = await res.json();
      if (res.ok && data.success) {
        clearInterval(timerHandle);
        const userType = data.customer?.type || data.user?.type || accountType;
        appState.currentUser = { ...(data.customer || data.user || {}), userType };
        if (data.needsProfile) { profName = ''; profPhone = ''; loginStep = 'profile'; }
        else redirect(userType, data.customer?.name || data.user?.name || identifier.trim());
      } else { appState.playBuzzerSound?.(); errorMsg = data.error || 'Invalid verification code.'; }
    } catch (err) { appState.playBuzzerSound?.(); errorMsg = 'Verification error: ' + err.message; }
    finally { isLoading = false; }
  }

  async function submitLoginProfile(e) {
    if (e) e.preventDefault();
    if (!profName.trim() || !profPhone.trim()) return;
    clearMessages(); isLoading = true;
    const accountType = resolvedType || 'subscriber';
    const profileMap = { subscriber: 'customer', org_user: 'operator', supplier: 'supplier' };
    try {
      const res = await fetch('/api/auth/complete-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountType: profileMap[accountType] || 'customer', email: identifier.trim().toLowerCase(), fullName: profName.trim(), phone: profPhone.trim(), address: profAddress.trim() || null, birthday: profBirthday || null, allergies: profAllergies, dietaryPrefs: profDietary }) });
      const data = await res.json();
      if (res.ok && data.success) { appState.currentUser = { ...appState.currentUser, name: profName.trim() }; redirect(accountType, profName.trim()); }
      else { appState.playBuzzerSound?.(); errorMsg = data.error || 'Profile submission failed.'; }
    } catch (err) { appState.playBuzzerSound?.(); errorMsg = 'Error: ' + err.message; }
    finally { isLoading = false; }
  }

  async function handleGoogleLogin(response) {
    clearMessages(); isLoading = true;
    try {
      const res = await fetch('/api/auth/google-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential }) });
      const data = await res.json(); isLoading = false;
      if (res.ok && data.success) {
        appState.currentUser = { ...data.customer, userType: 'subscriber' };
        if (data.needsOtp) { identifier = data.email; successMsg = 'Google authenticated. Verification code sent!'; loginStep = 'otp'; startCountdown(); setTimeout(() => successMsg = '', 4000); }
        else redirect('subscriber', data.name || data.customer?.name);
      } else { appState.playBuzzerSound?.(); errorMsg = data.error || 'Google Authentication failed.'; }
    } catch (err) { isLoading = false; appState.playBuzzerSound?.(); errorMsg = 'Google auth error: ' + err.message; }
  }

  function goBackToIdentifier() { clearInterval(timerHandle); loginStep = 'identifier'; otpCode = ''; debugOtp = ''; clearMessages(); }

  // ── SIGN-UP FLOW ────────────────────────────────────────────────────────────
  function selectRole(role) {
    appState.playClickSound?.();
    signupRole = role;
    // Delay step transition slightly so the click stamp scale punch visual is seen
    setTimeout(() => {
      signupStep = 'form';
      clearMessages();
    }, 150);
  }

  async function submitSignup(e) {
    if (e) e.preventDefault();
    clearMessages(); isLoading = true;
    const email = suEmail.trim(); const name = suFullName.trim(); const phone = suPhone.trim();
    const endpointMap = { customer: '/api/auth/register-subscriber', operator: '/api/auth/register-operator', supplier: '/api/auth/register-supplier' };
    const bodyMap = { customer: { email, name, phone }, operator: { email, name, phone }, supplier: { email, name, phone, company: suCompany.trim(), category: suCategory.trim() } };
    try {
      const res = await fetch(endpointMap[signupRole], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyMap[signupRole]) });
      const data = await res.json();
      if (res.ok && data.success) {
        debugOtp = data.otpCode || ''; identifier = email;
        const accountTypeMap = { customer: 'subscriber', operator: 'org_user', supplier: 'supplier' };
        resolvedType = accountTypeMap[signupRole];
        successMsg = `Verification code sent to ${email}`; signupStep = 'otp'; startCountdown();
        setTimeout(() => successMsg = '', 4000);
      } else { appState.playBuzzerSound?.(); errorMsg = data.error || 'Registration failed. Please try again.'; }
    } catch (err) { appState.playBuzzerSound?.(); errorMsg = 'Connection error: ' + err.message; }
    finally { isLoading = false; }
  }

  async function verifySignupOtp(e) {
    if (e) e.preventDefault();
    const code = otpCode.trim();
    if (code.length !== 6 || timerSecs <= 0) return;
    clearMessages(); isLoading = true;
    try {
      const accountTypeMap = { customer: 'subscriber', operator: 'org_user', supplier: 'supplier' };
      const accountType = accountTypeMap[signupRole] || 'subscriber';
      const res = await fetch('/api/auth/verify-email-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: identifier.trim(), otp: code, accountType }) });
      const data = await res.json();
      if (res.ok && data.success) {
        clearInterval(timerHandle); appState.currentUser = { ...(data.customer || data.user || {}), userType: accountType };
        if (data.needsProfile) { profName = suFullName.trim(); profPhone = suPhone.trim(); signupStep = 'profile'; }
        else redirect(accountType, suFullName.trim() || data.user?.name);
      } else { appState.playBuzzerSound?.(); errorMsg = data.error || 'Invalid verification code.'; }
    } catch (err) { appState.playBuzzerSound?.(); errorMsg = 'Verification error: ' + err.message; }
    finally { isLoading = false; }
  }

  async function submitSignupProfile(e) {
    if (e) e.preventDefault();
    if (!profName.trim() || !profPhone.trim()) return;
    clearMessages(); isLoading = true;
    const profileMap = { customer: 'customer', operator: 'operator', supplier: 'supplier' };
    const extraFields = signupRole === 'supplier' ? { company: suCompany.trim(), category: suCategory.trim() } : signupRole === 'operator' ? { position: suPosition.trim() || null } : {};
    try {
      const res = await fetch('/api/auth/complete-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountType: profileMap[signupRole], email: identifier.trim().toLowerCase(), fullName: profName.trim(), phone: profPhone.trim(), ...extraFields, address: profAddress.trim() || null, birthday: profBirthday || null, allergies: profAllergies, dietaryPrefs: profDietary }) });
      const data = await res.json();
      if (res.ok && data.success) {
        const accountTypeMap = { customer: 'subscriber', operator: 'org_user', supplier: 'supplier' };
        appState.currentUser = { ...appState.currentUser, name: profName.trim() };
        redirect(accountTypeMap[signupRole], profName.trim());
      } else { appState.playBuzzerSound?.(); errorMsg = data.error || 'Profile submission failed.'; }
    } catch (err) { appState.playBuzzerSound?.(); errorMsg = 'Error: ' + err.message; }
    finally { isLoading = false; }
  }

  async function handleGoogleSignup(response) {
    if (!signupRole) return;
    clearMessages(); isLoading = true;
    const endpointMap = { customer: '/api/auth/google-login', operator: '/api/auth/google-operator-login', supplier: '/api/auth/google-login' };
    try {
      const res = await fetch(endpointMap[signupRole], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential }) });
      const data = await res.json(); isLoading = false;
      if (res.ok && data.success) {
        identifier = data.email || data.user?.email || data.customer?.email;
        const accountTypeMap = { customer: 'subscriber', operator: 'org_user', supplier: 'supplier' };
        resolvedType = accountTypeMap[signupRole];
        if (data.needsOtp || data.needsProfile) { profName = suFullName.trim() || data.name || data.user?.name || ''; profPhone = suPhone.trim(); signupStep = 'profile'; }
        else redirect(resolvedType, data.name || data.customer?.name || data.user?.name);
      } else { appState.playBuzzerSound?.(); errorMsg = data.error || 'Google sign-up failed.'; }
    } catch (err) { isLoading = false; appState.playBuzzerSound?.(); errorMsg = 'Google auth error: ' + err.message; }
  }

  // ── Mount ───────────────────────────────────────────────────────────────────
  onMount(async () => {
    appState.initAudio?.();
    try {
      const res = await fetch('/api/auth/session'); const data = await res.json();
      if (data.authenticated && data.user) { appState.isAuthenticated = true; goto(data.redirect || '/'); return; }
    } catch { /* non-fatal */ }
    try {
      const res = await fetch('/api/settings'); const data = await res.json();
      if (res.ok && data.success) googleClientId = data.settings.googleClientId || '';
    } catch (e) { console.warn('Settings load error:', e.message); }
  });

  const roleMeta = {
    customer: { label: 'Customer', desc: 'Book catering events & manage orders', icon: Receipt, color: '#3E6650' },
    operator: { label: 'Operator', desc: 'Run catering operations & staff',       icon: ChefHat, color: '#4a6080' },
    supplier: { label: 'Supplier', desc: 'Supply ingredients & manage deliveries', icon: Boxes, color: '#8a6030' }
  };
</script>

<svelte:head>
  <title>CaterSync — Sign In</title>
  <meta name="description" content="Sign in to CaterSync. One unified entry for Customers, Operators, and Suppliers." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="login-root">
  <div class="ambient"></div>

  <!-- Greeting overlay -->
  {#if showGreeting}
    <div
      class="greeting-overlay"
      in:fade={{ duration: dur(220), easing: cubicOut }}
      out:fade={{ duration: dur(150) }}
    >
      <div class="greeting-inner" in:scale={{ duration: dur(320), start: 0.88, easing: quintOut, delay: dly(60) }}>
        <div class="greeting-icon text-[#3E6650] dark:text-emerald-400" in:scale={{ duration: dur(480), start: 0.4, easing: elasticOut, delay: dly(140) }}>
          <!-- Premium Kitchen Cloche (Serving Dome) SVG -->
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block">
            <path d="M2 20h20" />
            <path d="M20 16a8 8 0 1 0-16 0" />
            <path d="M12 4V2" />
            <path d="M10 2h4" />
          </svg>
        </div>
        <p class="greeting-text" in:fly={{ y: 6, duration: dur(240), easing: cubicOut, delay: dly(200) }}>{greetingMsg}</p>
        <p class="greeting-sub" in:fade={{ duration: dur(200), delay: dly(280) }}>Redirecting…</p>
        <div class="dots">
          <span style="animation-delay:0ms"></span>
          <span style="animation-delay:150ms"></span>
          <span style="animation-delay:300ms"></span>
        </div>
      </div>
    </div>
  {/if}

  <a href="/" id="back-home-link" class="back-link flex items-center gap-1.5">
    <CornerUpLeft size={13} />
    <span>Back</span>
  </a>

  <div class="main-col">

    <!-- Brand -->
    <div class="brand">
      <div class="brand-logo">
        <img src={logoImg} alt="CaterSync Logo" width="34" height="34" class="object-contain" />
      </div>
      <span class="brand-name">CaterSync</span>
    </div>

    {#if view === 'login'}
      <!-- ══ LOGIN CARD (Ticket Card style) ══ -->
      <div 
        class="ticket-card ticket-print-in p-6"
        in:fly={{ y: dur(8), duration: dur(260), easing: cubicOut }}
        out:fade={{ duration: dur(120), easing: cubicOut }}
      >
        <div class="login-card-body-stack">
          {#key loginStep}
            <div
              class="login-card-step"
              in:fly={{ x: dur(flyInX(loginDirection)), duration: dur(240), delay: dly(60), easing: cubicOut }}
              out:fly={{ x: dur(flyOutX(loginDirection)), duration: dur(180), easing: cubicOut }}
            >
              {#if isLoading && view === 'login'}
                <div class="loading-state">
                  <div class="spinner"></div>
                  <span>Authenticating…</span>
                </div>

              {:else if loginStep === 'identifier'}
                <div class="card-header" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(0) }}>
                  <h1 class="card-title">Welcome back</h1>
                  <p class="card-sub">Enter your email to continue</p>
                </div>

                {#if googleClientId}
                  <div id="google-btn-login" class="google-btn-wrap" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(40) }}></div>
                  <div class="divider" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(80) }}><span>or</span></div>
                {/if}

                <form onsubmit={submitIdentifier} class="form">
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(120) }}>
                    <label for="login-email" class="label">Email address</label>
                    <input id="login-email" type="email" bind:value={identifier} placeholder="you@example.com" autocomplete="email" class="input" required />
                  </div>
                  {#if errorMsg}
                    <p class="error-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{errorMsg}</p>
                  {/if}
                  {#if successMsg}
                    <p class="success-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{successMsg}</p>
                  {/if}
                  <button id="login-continue-btn" type="submit" class="primary-btn" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(160) }}>Continue</button>
                </form>

                <p class="switch-link" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(200) }}>
                  Don't have an account?
                  <button id="goto-signup-btn" class="link-btn" onclick={() => { appState.playClickSound?.(); view = 'signup'; signupStep = 'role'; clearMessages(); }}>Sign Up →</button>
                </p>

              {:else if loginStep === 'otp'}
                <div class="card-header" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(0) }}>
                  <button class="back-btn flex items-center gap-1.5" onclick={goBackToIdentifier}>
                    <CornerUpLeft size={12} />
                    <span>Back</span>
                  </button>
                  <h1 class="card-title">Check your inbox</h1>
                  <p class="card-sub">Code sent to <strong>{identifier}</strong></p>
                </div>

                {#if debugOtp}
                  <div class="debug-banner" in:fly={{ y: -6, duration: dur(200), easing: cubicOut, delay: dly(40) }} out:fade={{ duration: dur(100) }}>
                    ⚠️ Dev mode — OTP: <strong class="debug-code">{debugOtp}</strong>
                  </div>
                {/if}

                <form onsubmit={verifyLoginOtp} class="form">
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(80) }}>
                    <label for="login-otp" class="label">6-digit verification code</label>
                    <input id="login-otp" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" bind:value={otpCode} oninput={() => { if (otpCode.trim().length === 6 && timerSecs > 0) verifyLoginOtp(); }} class="otp-input" placeholder="000000" required />
                  </div>
                  <div class="timer-row" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(120) }}>
                    <span class="timer-label">Expires in</span>
                    <span class="timer-val {timerSecs <= 60 ? 'timer-warn' : ''}">{fmtTimer(timerSecs)}</span>
                  </div>
                  {#if errorMsg}<p class="error-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{errorMsg}</p>{/if}
                  {#if successMsg}<p class="success-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{successMsg}</p>{/if}
                  <button id="login-verify-btn" type="submit" class="primary-btn" disabled={otpCode.trim().length !== 6 || timerSecs <= 0} in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(160) }}>Verify & Sign In</button>
                  <button type="button" id="login-resend-btn" class="ghost-btn" onclick={submitIdentifier} in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(200) }}>Resend code</button>
                </form>

              {:else if loginStep === 'profile'}
                <div class="card-header" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(0) }}>
                  <div class="steps-row">
                    <span class="step done"><Check size={11} strokeWidth={3} /></span><div class="step-line done"></div>
                    <span class="step done"><Check size={11} strokeWidth={3} /></span><div class="step-line done"></div>
                    <span class="step active">3</span>
                  </div>
                  <h1 class="card-title">Complete your profile</h1>
                  <p class="card-sub">A few more details to get you started</p>
                </div>
                <form onsubmit={submitLoginProfile} class="form">
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(40) }}><label for="lp-name" class="label">Full Name <span class="req">*</span></label><input id="lp-name" type="text" bind:value={profName} placeholder="Juan dela Cruz" class="input" required /></div>
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(80) }}><label for="lp-phone" class="label">Phone Number <span class="req">*</span></label><input id="lp-phone" type="tel" bind:value={profPhone} placeholder="+63 917 123 4567" class="input" required /></div>
                  {#if (resolvedType || 'subscriber') === 'subscriber'}
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(120) }}><label for="lp-address" class="label">Address</label><input id="lp-address" type="text" bind:value={profAddress} placeholder="Street, Barangay, City" class="input" /></div>
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(160) }}><label for="lp-bday" class="label">Birthday</label><input id="lp-bday" type="date" bind:value={profBirthday} class="input" /></div>
                  {/if}
                  {#if errorMsg}<p class="error-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{errorMsg}</p>{/if}
                  <button id="login-complete-profile-btn" type="submit" class="primary-btn" disabled={!profName.trim() || !profPhone.trim()} in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(200) }}>Save & Continue</button>
                </form>
              {/if}
            </div>
          {/key}
        </div>
      </div>

    {:else if view === 'signup'}
      <!-- ══ SIGNUP CARD (Ticket Card style) ══ -->
      <div 
        class="ticket-card ticket-print-in p-6"
        in:fly={{ y: dur(14), duration: dur(320), easing: quintOut }}
        out:fly={{ y: dur(8), duration: dur(180), easing: cubicOut }}
      >
        <div class="signup-card-body-stack">
          {#key signupStep}
            <div
              class="signup-card-step"
              in:fly={{ x: dur(flyInX(signupDirection)), duration: dur(240), delay: dly(60), easing: cubicOut }}
              out:fly={{ x: dur(flyOutX(signupDirection)), duration: dur(180), easing: cubicOut }}
            >
              {#if isLoading && view === 'signup'}
                <div class="loading-state"><div class="spinner"></div><span>Processing…</span></div>

              {:else if signupStep === 'role'}
                <div class="card-header" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(0) }}>
                  <h2 class="card-title">Create account</h2>
                  <p class="card-sub">I am a…</p>
                </div>
                <div class="role-grid">
                  {#each Object.entries(roleMeta) as [key, meta], i}
                    <button
                      id="role-{key}-btn"
                      class="role-card {signupRole === key ? 'role-selected role-stamped' : ''} {signupRole && signupRole !== key ? 'role-receded' : ''}"
                      onclick={() => selectRole(key)}
                      style="--rc: {meta.color}"
                      in:fly={{ y: dur(10), duration: dur(220), easing: cubicOut, delay: dly(i * 50 + 40) }}
                    >
                      <span class="role-icon"><svelte:component this={meta.icon} size={18} /></span>
                      <span class="role-label">{meta.label}</span>
                      <span class="role-desc">{meta.desc}</span>
                    </button>
                  {/each}
                </div>
                {#if errorMsg}<p class="error-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{errorMsg}</p>{/if}

                <p class="switch-link mt-6" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(220) }}>
                  Already have an account?
                  <button id="goto-login-btn" class="link-btn" onclick={() => { appState.playClickSound?.(); view = 'login'; loginStep = 'identifier'; clearMessages(); }}>Log In ↑</button>
                </p>

              {:else if signupStep === 'form'}
                <div class="card-header" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(0) }}>
                  <button class="back-btn flex items-center gap-1.5" onclick={() => { signupStep = 'role'; signupRole = null; clearMessages(); }}>
                    <CornerUpLeft size={12} />
                    <span>Back</span>
                  </button>
                  <h2 class="card-title">
                    {#if roleMeta[signupRole]}
                      <span class="inline-flex align-middle mr-1.5"><svelte:component this={roleMeta[signupRole].icon} size={18} /></span>
                    {/if}
                    {roleMeta[signupRole]?.label} Sign Up
                  </h2>
                </div>
                {#if googleClientId}
                  <div id="google-btn-signup" class="google-btn-wrap" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(30) }}></div>
                  <div class="divider" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(60) }}><span>or</span></div>
                {/if}
                <form onsubmit={submitSignup} class="form">
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(90) }}><label for="su-name" class="label">Full Name <span class="req">*</span></label><input id="su-name" type="text" bind:value={suFullName} placeholder="Juan dela Cruz" class="input" required /></div>
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(130) }}><label for="su-phone" class="label">Phone Number <span class="req">*</span></label><input id="su-phone" type="tel" bind:value={suPhone} placeholder="09171234567" class="input" required /></div>
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(170) }}><label for="su-email" class="label">Email <span class="req">*</span></label><input id="su-email" type="email" bind:value={suEmail} placeholder="name@example.com" class="input" autocomplete="email" required /></div>
                  {#if signupRole === 'supplier'}
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(210) }}><label for="su-company" class="label">Company Name <span class="req">*</span></label><input id="su-company" type="text" bind:value={suCompany} placeholder="ABC Suppliers Inc." class="input" required /></div>
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(250) }}><label for="su-category" class="label">Category</label><input id="su-category" type="text" bind:value={suCategory} placeholder="e.g. Meat, Produce, Beverages" class="input" /></div>
                  {:else if signupRole === 'operator'}
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(210) }}><label for="su-position" class="label">Position / Role</label><input id="su-position" type="text" bind:value={suPosition} placeholder="e.g. Head Chef, Catering Manager" class="input" /></div>
                  {/if}
                  {#if errorMsg}<p class="error-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{errorMsg}</p>{/if}
                  {#if successMsg}<p class="success-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{successMsg}</p>{/if}
                  <button id="su-create-btn" type="submit" class="primary-btn" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(290) }}>Create Account</button>
                </form>

              {:else if signupStep === 'otp'}
                <div class="card-header" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(0) }}>
                  <button class="back-btn flex items-center gap-1.5" onclick={() => { signupStep = 'form'; otpCode = ''; clearMessages(); }}>
                    <CornerUpLeft size={12} />
                    <span>Back</span>
                  </button>
                  <h2 class="card-title">Verify your email</h2>
                  <p class="card-sub">Code sent to <strong>{identifier}</strong></p>
                </div>
                {#if debugOtp}
                  <div class="debug-banner" in:fly={{ y: -6, duration: dur(200), easing: cubicOut, delay: dly(40) }} out:fade={{ duration: dur(100) }}>
                    ⚠️ Dev mode — OTP: <strong class="debug-code">{debugOtp}</strong>
                  </div>
                {/if}
                <form onsubmit={verifySignupOtp} class="form">
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(80) }}>
                    <label for="su-otp" class="label">6-digit verification code</label>
                    <input id="su-otp" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" bind:value={otpCode} oninput={() => { if (otpCode.trim().length === 6 && timerSecs > 0) verifySignupOtp(); }} class="otp-input" placeholder="000000" required />
                  </div>
                  <div class="timer-row" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(120) }}>
                    <span class="timer-label">Expires in</span>
                    <span class="timer-val {timerSecs <= 60 ? 'timer-warn' : ''}">{fmtTimer(timerSecs)}</span>
                  </div>
                  {#if errorMsg}<p class="error-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{errorMsg}</p>{/if}
                  {#if successMsg}<p class="success-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{successMsg}</p>{/if}
                  <button id="su-verify-btn" type="submit" class="primary-btn" disabled={otpCode.trim().length !== 6 || timerSecs <= 0} in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(160) }}>Verify Email</button>
                  <button type="button" id="su-resend-btn" class="ghost-btn" onclick={submitSignup} in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(200) }}>Resend code</button>
                </form>

              {:else if signupStep === 'profile'}
                <div class="card-header" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(0) }}>
                  <div class="steps-row">
                    <span class="step done"><Check size={11} strokeWidth={3} /></span><div class="step-line done"></div>
                    <span class="step done"><Check size={11} strokeWidth={3} /></span><div class="step-line done"></div>
                    <span class="step active">3</span>
                  </div>
                  <h2 class="card-title">Almost done!</h2>
                  <p class="card-sub">Finish setting up your {roleMeta[signupRole]?.label} account</p>
                </div>
                <form onsubmit={submitSignupProfile} class="form">
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(40) }}><label for="spp-name" class="label">Full Name <span class="req">*</span></label><input id="spp-name" type="text" bind:value={profName} placeholder="Juan dela Cruz" class="input" required /></div>
                  <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(80) }}><label for="spp-phone" class="label">Phone Number <span class="req">*</span></label><input id="spp-phone" type="tel" bind:value={profPhone} placeholder="+63 917 123 4567" class="input" required /></div>
                  {#if signupRole === 'customer'}
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(120) }}><label for="spp-address" class="label">Address</label><input id="spp-address" type="text" bind:value={profAddress} placeholder="Street, Barangay, City" class="input" /></div>
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(160) }}><label for="spp-bday" class="label">Birthday</label><input id="spp-bday" type="date" bind:value={profBirthday} class="input" /></div>
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(200) }}>
                      <label class="label">Dietary Preferences</label>
                      <div class="chips">
                        {#each DIETARY_OPTIONS as opt}
                          <button type="button" onclick={() => { toggleChip(profDietary, opt); profDietary = [...profDietary]; }} class="chip {profDietary.includes(opt) ? 'chip-on' : ''}">{opt}</button>
                        {/each}
                      </div>
                    </div>
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(240) }}>
                      <label class="label">Allergies</label>
                      <div class="chips">
                        {#each ALLERGY_OPTIONS as opt}
                          <button type="button" onclick={() => { toggleChip(profAllergies, opt); profAllergies = [...profAllergies]; }} class="chip allergy-chip {profAllergies.includes(opt) ? 'chip-allergy-on' : ''}">{opt}</button>
                        {/each}
                      </div>
                    </div>
                  {:else if signupRole === 'operator'}
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(120) }}><label for="spp-pos" class="label">Position / Role</label><input id="spp-pos" type="text" bind:value={suPosition} placeholder="Head Chef, Catering Manager" class="input" /></div>
                  {:else if signupRole === 'supplier'}
                    <div class="field" in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(120) }}><label for="spp-company" class="label">Company Name <span class="req">*</span></label><input id="spp-company" type="text" bind:value={suCompany} placeholder="ABC Suppliers Inc." class="input" required /></div>
                  {/if}
                  {#if errorMsg}<p class="error-msg" in:fly={{ y: -4, duration: dur(180), easing: cubicOut }} out:fade={{ duration: dur(120) }}>{errorMsg}</p>{/if}
                  <button id="su-complete-btn" type="submit" class="primary-btn" disabled={!profName.trim() || !profPhone.trim()} in:fly={{ y: dur(8), duration: dur(200), easing: cubicOut, delay: dly(280) }}>Complete Sign Up</button>
                </form>
              {/if}
            </div>
          {/key}
        </div>
      </div>
    {/if}

    <p class="footer-mark">CaterSync Operations Inc. · Unified Portal</p>

  </div><!-- /main-col -->
</div>

<style>
  :global(body) { margin: 0; padding: 0; }

  /* ── Theme tokens — light by default, dark via .dark on <html> ─────────────
     Matches the existing CaterSync toggle: darkThemeEnabled adds/removes
     document.documentElement.classList('dark') in +layout.svelte ---------- */
  :root {
    --li-bg:          #F6F2EA;
    --li-title:       #2A2521;
    --li-sub:         #767068;
    --li-label:       #767068;
    --li-in-bg:       #F6F2EA;
    --li-in-bdr:      #D6D0C8;
    --li-in-txt:      #2A2521;
    --li-in-ph:       #b0a898;
    --li-divider:     #D6D0C8;
    --li-brand:       #4c3227;
    --li-ghost:       #b0a898;
    --li-ghost-h:     #767068;
    --li-muted:       #D6D0C8;
    --li-back:        #b0a898;
    --li-back-h:      #767068;
    --li-role-bg:     #F6F2EA;
    --li-role-bdr:    #D6D0C8;
    --li-role-h:      #EDE8E0;
    --li-role-lbl:    #2A2521;
    --li-role-desc:   #b0a898;
    --li-chip-bg:     #F0EBE3;
    --li-chip-bdr:    #D6D0C8;
    --li-chip-txt:    #767068;
    --li-spin-trk:    #D6D0C8;
    --li-tmr-bg:      #F0EBE3;
    --li-tmr-bdr:     #D6D0C8;
    --li-tmr-lbl:     #b0a898;
    --li-dbg-bg:      #FFFBEA;
    --li-dbg-bdr:     #F0D060;
    --li-dbg-txt:     #8a6e20;
    --li-dbg-c-bg:    #FEF9C3;
    --li-dbg-c-bdr:   #E8C840;
    --li-dbg-c-txt:   #7a5a10;
    --li-err-bg:      #FEF2F2;
    --li-err-bdr:     #FECACA;
    --li-err-txt:     #991b1b;
    --li-ok-bg:       #F0FDF4;
    --li-ok-bdr:      #BBF7D0;
    --li-ok-txt:      #166534;
    --li-greet-bg:    rgba(246,242,234,0.96);
    --li-greet-txt:   #2A2521;
    --li-greet-sub:   #b0a898;
    --li-footer:      #D6D0C8;
    --li-glow:        rgba(62,102,80,0.04);
  }
  :root.dark {
    --li-bg:          #111110;
    --li-title:       #ddd8d0;
    --li-sub:         #4a4a47;
    --li-label:       #4a4a47;
    --li-in-bg:       #141412;
    --li-in-bdr:      #242422;
    --li-in-txt:      #c9c4bc;
    --li-in-ph:       #2e2e2b;
    --li-divider:     #242422;
    --li-brand:       #c9c4bc;
    --li-ghost:       #3d3d3a;
    --li-ghost-h:     #6b6b68;
    --li-muted:       #3d3d3a;
    --li-back:        #3d3d3a;
    --li-back-h:      #6b6b68;
    --li-role-bg:     #141412;
    --li-role-bdr:    #242422;
    --li-role-h:      #1a1a17;
    --li-role-lbl:    #c9c4bc;
    --li-role-desc:   #3d3d3a;
    --li-chip-bg:     #141412;
    --li-chip-bdr:    #242422;
    --li-chip-txt:    #4a4a47;
    --li-spin-trk:    #2a2a27;
    --li-tmr-bg:      #141412;
    --li-tmr-bdr:     #1e1e1c;
    --li-tmr-lbl:     #3d3d3a;
    --li-dbg-bg:      #1a1500;
    --li-dbg-bdr:     #332800;
    --li-dbg-txt:     #8a6e20;
    --li-dbg-c-bg:    #251d00;
    --li-dbg-c-bdr:   #3d3200;
    --li-dbg-c-txt:   #c8a030;
    --li-err-bg:      #1a0f0f;
    --li-err-bdr:     #3d1a1a;
    --li-err-txt:     #c07070;
    --li-ok-bg:       #0f1a12;
    --li-ok-bdr:      #1e3d24;
    --li-ok-txt:      #5a9474;
    --li-greet-bg:    rgba(17,17,16,0.96);
    --li-greet-txt:   #ddd8d0;
    --li-greet-sub:   #3d3d3a;
    --li-footer:      #222220;
    --li-glow:        rgba(62,102,80,0.07);
  }

  .login-root {
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100svh;
    background: var(--li-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 56px 16px 40px;
    position: relative;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    transition: background 0.2s;
  }

  .ambient {
    position: fixed; inset: 0;
    background: radial-gradient(ellipse 70% 50% at 50% 30%, var(--li-glow) 0%, transparent 70%);
    pointer-events: none;
  }

  .back-link { position: absolute; top: 18px; left: 20px; font-size: 12px; color: var(--li-back); text-decoration: none; transition: color 0.15s; font-weight: 500; }
  .back-link:hover { color: var(--li-back-h); }

  .main-col { width: 100%; max-width: 360px; display: flex; flex-direction: column; }

  .brand { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px; }
  .brand-logo { filter: drop-shadow(0 0 6px rgba(110,231,183,0.2)); }
  .brand-name { font-size: 15px; font-weight: 600; color: var(--li-brand); letter-spacing: -0.2px; }

  .card-header { margin-bottom: 20px; }
  .card-title { margin: 0 0 4px; font-size: 17px; font-weight: 600; color: var(--li-title); letter-spacing: -0.2px; }
  .card-sub { margin: 0; font-size: 12px; color: var(--li-sub); }

  .loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 0; color: var(--li-sub); font-size: 12px; }
  .spinner { width: 28px; height: 28px; border: 2px solid var(--li-spin-trk); border-top-color: #3E6650; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .google-btn-wrap { width: 100%; display: flex; justify-content: center; min-height: 44px; margin-bottom: 4px; border-radius: 8px; overflow: hidden; }

  .divider { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 11px; }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--li-divider); }
  .divider span { color: var(--li-ghost); }

  .form { display: flex; flex-direction: column; gap: 14px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .label { font-size: 11px; font-weight: 500; color: var(--li-label); letter-spacing: 0.01em; }
  .req { color: #c0392b; }

  .input { width: 100%; padding: 9px 12px; background: var(--li-in-bg); border: 1px solid var(--li-in-bdr); border-radius: 8px; color: var(--li-in-txt); font-family: inherit; font-size: 13px; outline: none; transition: border-color 0.15s, background 0.15s; box-sizing: border-box; }
  .input:focus { border-color: #3E6650; }
  .input::placeholder { color: var(--li-in-ph); }

  .otp-input { width: 100%; padding: 12px; background: var(--li-in-bg); border: 1.5px solid var(--li-in-bdr); border-radius: 8px; color: var(--li-title); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 24px; font-weight: 700; letter-spacing: 0.5em; text-align: center; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .otp-input:focus { border-color: #3E6650; }
  .otp-input::placeholder { color: var(--li-in-ph); letter-spacing: 0.5em; }

  .timer-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 8px 10px; background: var(--li-tmr-bg); border: 1px solid var(--li-tmr-bdr); border-radius: 6px; }
  .timer-label { color: var(--li-tmr-lbl); font-weight: 500; }
  .timer-val { color: #3E6650; font-weight: 600; font-family: monospace; }
  .timer-warn { color: #c0392b; }

  .primary-btn { width: 100%; padding: 10px; background: #3E6650; border: 1px solid #335542; border-radius: 8px; color: #fff; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s; outline: none; }
  .primary-btn:hover:not(:disabled) { background: #4a7a60; transform: translateY(-1px); }
  .primary-btn:active:not(:disabled) { transform: translateY(0); }
  .primary-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .ghost-btn { width: 100%; padding: 8px; background: transparent; border: none; color: var(--li-ghost); font-family: inherit; font-size: 12px; cursor: pointer; transition: color 0.15s; outline: none; }
  .ghost-btn:hover { color: var(--li-ghost-h); }

  .back-btn { background: transparent; border: none; color: var(--li-back); font-family: inherit; font-size: 11px; cursor: pointer; padding: 0; margin-bottom: 8px; transition: color 0.15s; }
  .back-btn:hover { color: var(--li-back-h); }

  .switch-link { margin: 14px 0 0; font-size: 11px; color: var(--li-ghost); text-align: center; }
  .link-btn { background: none; border: none; color: #3E6650; font-family: inherit; font-size: 11px; cursor: pointer; padding: 0; font-weight: 500; transition: color 0.15s; }
  .link-btn:hover { color: #5a9474; }

  .debug-banner { padding: 8px 10px; background: var(--li-dbg-bg); border: 1px solid var(--li-dbg-bdr); border-radius: 6px; font-size: 11px; color: var(--li-dbg-txt); margin-bottom: 4px; }
  .debug-code { background: var(--li-dbg-c-bg); padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: var(--li-dbg-c-txt); user-select: all; border: 1px solid var(--li-dbg-c-bdr); }

  .steps-row { display: flex; align-items: center; gap: 4px; margin-bottom: 12px; }
  .step { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; flex-shrink: 0; }
  .step.done { background: #e8f5ee; border: 1px solid #3E6650; color: #3E6650; }
  .step.active { background: #3E6650; color: #fff; }
  :root.dark .step.done { background: #1e2d24; }
  .step-line { flex: 1; height: 1px; }
  .step-line.done { background: #3E6650; }

  .role-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
  
  /* ── Tactile role choices ── */
  .role-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--li-role-bg);
    border: 1px solid var(--li-role-bdr);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.18s ease, 
                background-color 0.18s ease, 
                transform 0.15s cubic-bezier(0.25, 1, 0.5, 1),
                opacity 0.2s ease,
                filter 0.2s ease;
    font-family: inherit;
    width: 100%;
    outline: none;
  }
  .role-card:hover {
    border-color: var(--rc, #3E6650);
    background: var(--li-role-h);
    transform: translateY(-2px) scale(1.015);
    box-shadow: 0 4px 10px rgba(42, 37, 33, 0.05);
  }
  .role-card:active {
    transform: scale(0.96);
  }
  .role-card.role-selected {
    border-color: var(--rc, #3E6650);
    background: color-mix(in srgb, var(--rc, #3E6650) 8%, var(--li-role-bg));
  }
  
  /* Tactical ink-stamp punch */
  .role-stamped {
    animation: stamp-punch 0.16s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    border-color: var(--rc) !important;
    border-width: 1.5px !important;
  }
  @keyframes stamp-punch {
    0% { transform: scale(0.95); }
    50% { transform: scale(1.04); }
    100% { transform: scale(1); }
  }

  /* Unselected options fade/desaturate */
  .role-receded {
    opacity: 0.45 !important;
    filter: grayscale(80%) !important;
  }

  .role-icon { font-size: 18px; flex-shrink: 0; }
  .role-label { font-size: 13px; font-weight: 600; color: var(--li-role-lbl); display: block; line-height: 1.2; }
  .role-desc { font-size: 10px; color: var(--li-role-desc); display: block; margin-top: 2px; line-height: 1.3; }

  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .chip { padding: 4px 10px; border-radius: 100px; font-size: 10px; font-weight: 500; font-family: inherit; cursor: pointer; border: 1px solid var(--li-chip-bdr); background: var(--li-chip-bg); color: var(--li-chip-txt); transition: all 0.12s; outline: none; }
  .chip:hover { border-color: #3E6650; color: #3E6650; }
  .chip-on { background: #e8f5ee; border-color: #3E6650; color: #3E6650; }
  :root.dark .chip-on { background: #1e2d24; color: #7ec8a0; }
  .chip-allergy-on { background: #fef2f2; border-color: #c0392b; color: #c0392b; }
  :root.dark .chip-allergy-on { background: #2d1a1a; border-color: #8b3030; color: #e07070; }

  .error-msg { margin: 0; padding: 8px 10px; background: var(--li-err-bg); border: 1px solid var(--li-err-bdr); border-radius: 6px; font-size: 11px; color: var(--li-err-txt); line-height: 1.4; }
  .success-msg { margin: 0; padding: 8px 10px; background: var(--li-ok-bg); border: 1px solid var(--li-ok-bdr); border-radius: 6px; font-size: 11px; color: var(--li-ok-txt); line-height: 1.4; }

  .greeting-overlay { position: fixed; inset: 0; z-index: 100; background: var(--li-greet-bg); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; }
  .greeting-inner { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .greeting-icon { font-size: 36px; animation: bounce 0.8s ease infinite alternate; }
  @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-6px); } }
  .greeting-text { margin: 0; font-size: 18px; font-weight: 600; color: var(--li-greet-txt); }
  .greeting-sub { margin: 0; font-size: 11px; color: var(--li-greet-sub); letter-spacing: 0.05em; text-transform: uppercase; }
  .dots { display: flex; gap: 6px; margin-top: 4px; }
  .dots span { width: 6px; height: 6px; border-radius: 50%; background: #3E6650; animation: dot-pulse 1.2s ease-in-out infinite; }
  @keyframes dot-pulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

  .footer-mark { text-align: center; font-size: 10px; color: var(--li-footer); margin: 20px 0 0; letter-spacing: 0.05em; user-select: none; }

  /* ── Grid stacked animations for smooth in-place layout swaps ── */
  .login-card-body-stack, .signup-card-body-stack {
    display: grid;
    grid-template-columns: 100%;
    grid-template-rows: auto;
  }
  .login-card-step, .signup-card-step {
    grid-area: 1 / 1 / 2 / 2;
    width: 100%;
  }

  @media (min-width: 480px) {
    .main-col { max-width: 380px; }
    .role-grid { flex-direction: row; }
    .role-card { flex-direction: column; align-items: flex-start; gap: 6px; }
  }
</style>

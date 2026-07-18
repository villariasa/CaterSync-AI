<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import logoImg from '../../assets/catersync.png';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  // ── Reduced-motion guard ──────────────────────────────────────────────────
  const reduceMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  function dur(ms) { return reduceMotion ? 1 : ms; }
  function dly(ms) { return reduceMotion ? 0 : ms; }

  const appState = getCateringContext();

  let mounted = $state(false);
  let visible = $state(false);

  onMount(async () => {
    mounted = true;

    // Silent persistent session check — if already logged in, route straight to dashboard
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.user) {
        appState.currentUser = data.user;
        appState.isAuthenticated = true;
        goto(data.redirect || '/');
        return;
      }
    } catch (e) {
      console.warn('Silent session check failed:', e.message);
    }

    // Staggered entrance
    setTimeout(() => { visible = true; }, 60);
  });

  function handleContinue() {
    appState.playClickSound?.();
    goto('/login');
  }
</script>

<svelte:head>
  <title>CaterSync — Welcome</title>
  <meta name="description" content="CaterSync AI — your smart catering operations platform. Sign in to manage events, menus, inventory, and staff." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<!-- Full-screen dark canvas -->
<div class="landing-root">
  <!-- Subtle ambient glow -->
  <div class="ambient-glow"></div>

  <!-- Centered content -->
  <div class="landing-card">
    {#if visible}
      <!-- Logo mark -->
      <div 
        class="logo-wrap"
        in:fly={{ y: dur(10), duration: dur(250), easing: cubicOut, delay: dly(0) }}
      >
        <div class="logo-icon flex items-center justify-center">
          <img src={logoImg} alt="CaterSync Logo" class="w-20 h-20 object-contain" />
        </div>
        <div class="logo-glow"></div>
      </div>

      <!-- Headline -->
      <h1 
        class="headline"
        in:fly={{ y: dur(10), duration: dur(250), easing: cubicOut, delay: dly(50) }}
      >
        Welcome to CaterSync
      </h1>
      <p 
        class="subline"
        in:fly={{ y: dur(10), duration: dur(250), easing: cubicOut, delay: dly(100) }}
      >
        Smart catering operations, powered by AI
      </p>

      <!-- Primary CTA -->
      <button
        id="landing-continue-btn"
        class="continue-btn"
        onclick={handleContinue}
        in:fly={{ y: dur(10), duration: dur(250), easing: cubicOut, delay: dly(160) }}
      >
        Continue
        <span class="btn-arrow">↵</span>
      </button>

      <!-- Divider hint -->
      <p 
        class="trouble-link"
        in:fly={{ y: dur(10), duration: dur(250), easing: cubicOut, delay: dly(210) }}
      >
        <a href="mailto:support@catersync.ai" id="landing-trouble-link">
          Having trouble? Let us know
        </a>
      </p>
    {/if}
  </div>

  <!-- Bottom wordmark -->
  <p class="bottom-mark">CaterSync Operations Inc.</p>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }

  /* ── Theme tokens: light default, dark override ──
     The existing app toggles document.documentElement.classList('dark').
     These vars slot into that system with zero extra JS. -- */
  :root {
    --lp-bg:        #F6F2EA;
    --lp-glow:      rgba(62, 102, 80, 0.05);
    --lp-headline:  #2A2521;
    --lp-sub:       #767068;
    --lp-btn-bg:    #FFFFFF;
    --lp-btn-bdr:   #D6D0C8;
    --lp-btn-txt:   #4c3227;
    --lp-btn-arr:   #b0a898;
    --lp-btn-hover-bg:   #F0EBE3;
    --lp-btn-hover-bdr:  #b0a898;
    --lp-btn-hover-txt:  #2A2521;
    --lp-trouble:   #b0a898;
    --lp-trouble-h: #767068;
    --lp-mark:      #D6D0C8;
  }
  :root.dark {
    --lp-bg:        #111110;
    --lp-glow:      rgba(62, 102, 80, 0.07);
    --lp-headline:  #ede9e3;
    --lp-sub:       #5a5752;
    --lp-btn-bg:    #222220;
    --lp-btn-bdr:   #2e2e2b;
    --lp-btn-txt:   #c9c4bc;
    --lp-btn-arr:   #4a4a47;
    --lp-btn-hover-bg:   #2a2a27;
    --lp-btn-hover-bdr:  #3e3e3a;
    --lp-btn-hover-txt:  #ede9e3;
    --lp-trouble:   #3d3d3a;
    --lp-trouble-h: #6b6b68;
    --lp-mark:      #282826;
  }

  .landing-root {
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100svh;
    background: var(--lp-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    transition: background 0.2s;
  }

  .ambient-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 40% at 50% 50%, var(--lp-glow) 0%, transparent 70%);
    pointer-events: none;
  }

  /* ── Card ── */
  .landing-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0;
    position: relative;
    z-index: 10;
    padding: 0 24px;
  }

  /* ── Logo ── */
  .logo-wrap {
    position: relative;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .logo-icon {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 10px rgba(110, 231, 183, 0.25));
    animation: logo-float 4s ease-in-out infinite;
  }

  .logo-glow {
    position: absolute;
    inset: -8px;
    background: radial-gradient(circle, rgba(62, 102, 80, 0.18) 0%, transparent 70%);
    border-radius: 50%;
    animation: logo-pulse 3.5s ease-in-out infinite;
  }

  @keyframes logo-pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.12); }
  }

  @keyframes logo-float {
    0%, 100% {
      transform: translateY(0);
      opacity: 0.94;
    }
    50% {
      transform: translateY(-3px);
      opacity: 1;
    }
  }

  /* ── Text ── */
  .headline {
    margin: 0 0 8px;
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.3px;
    color: var(--lp-headline);
    line-height: 1.2;
  }

  .subline {
    margin: 0 0 28px;
    font-size: 12px;
    font-weight: 400;
    color: var(--lp-sub);
    letter-spacing: 0.01em;
  }

  /* ── Continue button ── */
  .continue-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 20px;
    background: var(--lp-btn-bg);
    border: 1px solid var(--lp-btn-bdr);
    border-radius: 8px;
    color: var(--lp-btn-txt);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    letter-spacing: 0.01em;
    transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
    outline: none;
    margin-bottom: 20px;
  }

  .continue-btn:hover {
    background: var(--lp-btn-hover-bg);
    border-color: var(--lp-btn-hover-bdr);
    color: var(--lp-btn-hover-txt);
    transform: translateY(-1px);
  }

  .continue-btn:active {
    transform: translateY(0);
    background: var(--lp-btn-bg);
  }

  .btn-arrow {
    font-size: 12px;
    color: var(--lp-btn-arr);
    font-family: monospace;
    transition: color 0.15s;
  }

  .continue-btn:hover .btn-arrow {
    color: var(--lp-trouble-h);
  }

  /* ── Trouble link ── */
  .trouble-link {
    margin: 0;
    font-size: 11px;
    color: var(--lp-trouble);
  }

  .trouble-link a {
    color: var(--lp-trouble);
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: var(--lp-btn-bdr);
    transition: color 0.15s, text-decoration-color 0.15s;
  }

  .trouble-link a:hover {
    color: var(--lp-trouble-h);
    text-decoration-color: var(--lp-trouble);
  }

  .bottom-mark {
    position: absolute;
    bottom: 24px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    color: var(--lp-mark);
    letter-spacing: 0.08em;
    font-weight: 400;
    pointer-events: none;
    user-select: none;
  }
</style>

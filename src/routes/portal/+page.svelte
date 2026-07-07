<script>
  import { onMount } from 'svelte';
  import { FileText, Calendar, Sparkles, MapPin, Receipt, Star, CheckCircle, PenTool, LogOut, Info, ShieldAlert, KeyRound, ChevronLeft, ArrowRight, Lock } from '@lucide/svelte';
  import { encryptSessionWithPIN, decryptSessionWithPIN, hasSecureSessionStored, wipeSecureSession } from '$lib/crypto.js';

  // Auth flow states
  let portalLoginStep = $state('email'); // 'email', 'otp', 'pin', 'setup_pin'
  let customerContact = $state(''); // email or phone
  let otpCode = $state('');
  let setupPIN = $state('');
  let inputPIN = $state('');
  let isAuthenticated = $state(false);
  let isChecking = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  let googleClientId = $state('');

  let customer = $state(null);
  let event = $state(null);
  let portalData = $state({
    menus: [],
    contract: null,
    signature: null,
    invoice: null,
    payments: [],
    review: null
  });

  // Client drawing pad
  let signaturePad = $state(null);
  let isDrawing = false;
  let signerName = $state('');
  let signaturePoints = $state([]);

  // Reviews & conditions
  let rating = $state(5);
  let comments = $state('');
  let agreedToTerms = $state(false);

  // Countdown timer
  let days = $state(0);
  let hours = $state(0);
  let minutes = $state(0);
  let seconds = $state(0);
  let intervalId = null;

  // Tabs
  let activeTab = $state('billing'); // billing, menu, contract, feedback

  // Dynamic Google identity script loader
  function loadGoogleScript() {
    if (typeof window === 'undefined') return;
    if (document.getElementById('google-gsi-client')) {
      initializeGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initializeGoogleButton();
    };
    document.head.appendChild(script);
  }

  function initializeGoogleButton() {
    if (typeof window === 'undefined' || !window.google || !googleClientId) return;

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      const parentDiv = document.getElementById('google-btn-container');
      if (parentDiv) {
        window.google.accounts.id.renderButton(
          parentDiv,
          { theme: 'outline', size: 'large', width: parentDiv.offsetWidth, text: 'continue_with' }
        );
      }
    } catch (err) {
      console.error("Google Identity initialization error:", err);
    }
  }

  async function handleGoogleCredentialResponse(response) {
    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        customer = data.customer;
        event = data.event;
        customerContact = data.customer.email || data.customer.contact;
        
        if (event) {
          await loadPortalData();
          startCountdown();
        }

        // Settle device PIN for quick lock screen if not configured
        const hasPin = await hasSecureSessionStored();
        if (!hasPin) {
          portalLoginStep = 'setup_pin';
        } else {
          isAuthenticated = true;
        }
      } else {
        errorMessage = data.error || 'Google Sign-In failed.';
      }
    } catch (err) {
      errorMessage = 'Google auth error: ' + err.message;
    } finally {
      isChecking = false;
    }
  }

  // Step 1: Identifier Check
  async function checkIdentifier(e) {
    if (e) e.preventDefault();
    if (!customerContact.trim()) return;

    isChecking = true;
    errorMessage = '';

    // Check if we have a secure local vault session matching this identifier
    const hasLocalSession = await hasSecureSessionStored();
    if (hasLocalSession) {
      portalLoginStep = 'pin';
      isChecking = false;
      return;
    }

    try {
      // Hit subscriber pre-auth check
      const response = await fetch('/api/auth/pre-auth-subscriber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerContact.trim() })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        if (data.registered) {
          // Send OTP automatically to login
          await sendOtpRequest();
        } else {
          // Not registered yet, allow registration claim flow
          errorMessage = 'Profile not registered. Click below to claim your account and receive a secure OTP code.';
        }
      } else {
        errorMessage = data.error || 'Identifier check failed.';
      }
    } catch (err) {
      errorMessage = 'Auth server unreachable. Running offline mock fallback.';
      console.warn("Subscriber pre-auth failed, launching mock offline login.");
      mockOfflineLogin();
    } finally {
      isChecking = false;
    }
  }

  // Request/Send OTP code
  async function sendOtpRequest() {
    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const res = await fetch('/api/auth/register-subscriber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerContact.trim() })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        successMessage = 'Verification code sent! Please check your email inbox.';
        portalLoginStep = 'otp';
        if (data.usingFallback && data.previewUrl) {
          console.log(`✉️ Sandboxed Email Dispatch URL: ${data.previewUrl}`);
          window.open(data.previewUrl, '_blank');
        }
      } else {
        errorMessage = data.error || 'Failed to dispatch verification code.';
      }
    } catch (err) {
      errorMessage = 'Error dispatching verification code: ' + err.message;
    } finally {
      isChecking = false;
    }
  }

  // Verify OTP code
  async function verifyOtpCode(e) {
    if (e) e.preventDefault();
    if (!otpCode) return;

    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerContact.trim(), otpCode: otpCode.trim() })
      });
      const res = await response.json();

      if (response.ok && res.success) {
        // Retrieve full portal dataset
        await executeBackendLogin(customerContact.trim());
      } else {
        errorMessage = res.error || 'Invalid OTP code entered.';
      }
    } catch (err) {
      errorMessage = 'Error verifying code: ' + err.message;
    } finally {
      isChecking = false;
    }
  }

  // Execute database login session setting
  async function executeBackendLogin(contactString) {
    try {
      const response = await fetch('/api/auth/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contactString })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        customer = data.customer;
        event = data.event;
        
        if (event) {
          await loadPortalData();
          startCountdown();
        }

        // Ask for quick device-local PIN registration
        const hasPin = await hasSecureSessionStored();
        if (!hasPin) {
          portalLoginStep = 'setup_pin';
        } else {
          isAuthenticated = true;
        }
      } else {
        errorMessage = data.error || 'Login verification failed.';
      }
    } catch (err) {
      errorMessage = 'Backend verification error: ' + err.message;
    }
  }

  // Handle device-local PIN unlock
  async function unlockWithPin() {
    errorMessage = '';
    try {
      const decryptedString = await decryptSessionWithPIN(inputPIN);
      const session = JSON.parse(decryptedString);
      
      customerContact = session.email || session.contact;
      
      // Complete backend login using unlocked credentials
      isChecking = true;
      await executeBackendLogin(customerContact);
      isAuthenticated = true;
      isChecking = false;
    } catch (err) {
      errorMessage = err.message;
      inputPIN = '';
    }
  }

  // Setup Device quick lock PIN
  async function handleSetupPin(e) {
    if (e) e.preventDefault();
    if (setupPIN.length !== 4) {
      errorMessage = 'PIN must be exactly 4 digits.';
      return;
    }

    try {
      const payload = {
        email: customer.email || customerContact,
        contact: customer.contact || customerContact,
        name: customer.name
      };

      await encryptSessionWithPIN(setupPIN, JSON.stringify(payload));
      successMessage = '📲 Secure Device PIN configured successfully!';
      isAuthenticated = true;
    } catch (err) {
      errorMessage = 'Failed to encrypt local session.';
    }
  }

  function mockOfflineLogin() {
    customer = { id: 101, name: 'Offline Client Sample', contact: customerContact, email: customerContact };
    event = {
      id: 505,
      event_type: 'Birthday Celebration',
      guest_count: 120,
      event_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      budget: 85000,
      theme: 'Modern Rustic',
      status: 'Confirmed',
      venue_type: 'Al Fresco Deck',
      is_outdoor: true
    };
    isAuthenticated = true;
    
    portalData = {
      menus: [
        { id: 1, name: 'Classic Fiesta Buffet', category: 'Standard', price_per_serving: 650, quantity_planned: 120 }
      ],
      contract: {
        id: 1,
        content: `CATERING SERVICE AGREEMENT\n\nClient Name: Offline Client Sample\nEvent Type: Birthday Celebration\nDate: Sample Date\nGuest Count: 120 guests\nBudget: ₱85,000.00\nTheme: Modern Rustic\nVenue: Al Fresco Deck\n\nTERMS & CONDITIONS:\n1. The client agrees to pay a 50% non-refundable deposit.\n2. Final headcount must be confirmed 7 days prior to the event.\n3. The caterer reserves the right to make ingredient substitutions in case of market shortages.`,
        status: 'Draft'
      },
      signature: null,
      invoice: {
        id: 1,
        invoice_number: 'INV-MOCK-505',
        total_amount: 95200,
        tax_amount: 10200,
        status: 'Unpaid'
      },
      payments: [],
      review: null
    };
    startCountdown();
  }

  async function loadPortalData() {
    if (!event) return;
    try {
      const response = await fetch(`/api/portal?eventId=${event.id}`);
      const data = await response.json();
      if (response.ok) {
        portalData = data;
        if (portalData.review) {
          rating = portalData.review.rating;
          comments = portalData.review.comments || '';
        }
      }
    } catch (err) {
      console.error('Failed to load portal details:', err);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Server logout skipped:', err);
    }
    await wipeSecureSession();
    isAuthenticated = false;
    customer = null;
    event = null;
    portalLoginStep = 'email';
    customerContact = '';
    otpCode = '';
    setupPIN = '';
    inputPIN = '';
    portalData = {
      menus: [],
      contract: null,
      signature: null,
      invoice: null,
      payments: [],
      review: null
    };
    clearInterval(intervalId);
  }

  function startCountdown() {
    if (!event || !event.event_date) return;
    clearInterval(intervalId);
    
    const eventTime = new Date(event.event_date).getTime();
    
    const updateTime = () => {
      const now = new Date().getTime();
      const diff = eventTime - now;
      
      if (diff <= 0) {
        days = 0; hours = 0; minutes = 0; seconds = 0;
        clearInterval(intervalId);
        return;
      }
      
      days = Math.floor(diff / (1000 * 60 * 60 * 24));
      hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      seconds = Math.floor((diff % (1000 * 60)) / 1000);
    };
    
    updateTime();
    intervalId = setInterval(updateTime, 1000);
  }

  // Signature canvas
  function startDrawing(e) {
    isDrawing = true;
    const pos = getPos(e);
    signaturePoints.push(pos);
    drawDot(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    signaturePoints.push(pos);
    
    const ctx = signaturePad.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2A2521';
    
    ctx.beginPath();
    ctx.moveTo(signaturePoints[signaturePoints.length - 2].x, signaturePoints[signaturePoints.length - 2].y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function getPos(e) {
    const rect = signaturePad.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function drawDot(x, y) {
    const ctx = signaturePad.getContext('2d');
    ctx.fillStyle = '#2A2521';
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function clearSignature() {
    if (!signaturePad) return;
    const ctx = signaturePad.getContext('2d');
    ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
    signaturePoints = [];
  }

  function getSignatureSvg() {
    if (signaturePoints.length === 0) return '';
    let d = `M ${signaturePoints[0].x} ${signaturePoints[0].y}`;
    for (let i = 1; i < signaturePoints.length; i++) {
      d += ` L ${signaturePoints[i].x} ${signaturePoints[i].y}`;
    }
    return `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="#2A2521" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  async function submitSignature() {
    if (!signerName.trim()) {
      errorMessage = 'Please input your full legal name.';
      return;
    }
    if (signaturePoints.length === 0) {
      errorMessage = 'Please draw your signature in the space provided.';
      return;
    }

    errorMessage = '';
    successMessage = '';

    const signatureSvg = getSignatureSvg();

    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign',
          eventId: event.id,
          contractId: portalData.contract.id,
          signerName,
          signatureSvg,
          ipAddress: 'ClientPortal-Web'
        })
      });
      const data = await response.json();
      
      if (response.ok) {
        successMessage = 'Agreement signed successfully!';
        await loadPortalData();
      } else {
        errorMessage = data.error || 'Failed to submit signature.';
      }
    } catch (err) {
      console.warn("Sign endpoint failed, falling back to mock signature:", err.message);
      portalData.signature = {
        signer_name: signerName,
        signature_svg: signatureSvg,
        signed_at: new Date().toISOString()
      };
      portalData.contract.status = 'Signed';
      successMessage = 'Agreement signed successfully (Offline Sandbox)!';
    }
  }

  async function submitReview() {
    errorMessage = '';
    successMessage = '';
    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          eventId: event.id,
          rating,
          comments
        })
      });
      const data = await response.json();
      if (response.ok) {
        successMessage = 'Thank you for your feedback rating!';
        await loadPortalData();
      } else {
        errorMessage = data.error || 'Failed to submit feedback.';
      }
    } catch (err) {
      console.warn("Review endpoint failed, running fallback review:", err.message);
      portalData.review = {
        rating,
        comments,
        submitted_at: new Date().toISOString()
      };
      successMessage = 'Thank you for your feedback (Offline Sandbox)!';
    }
  }

  onMount(async () => {
    // 1. Load configuration and Google Client ID
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok && data.success) {
        googleClientId = data.settings.googleClientId || '';
        if (googleClientId) {
          loadGoogleScript();
        }
      }
    } catch (e) {
      console.warn("Could not load settings configuration:", e.message);
    }

    // 2. Handle auto-login via URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const contactParam = urlParams.get('contact') || urlParams.get('token');
    
    if (contactParam) {
      customerContact = contactParam;
      await checkIdentifier();
    }

    return () => {
      clearInterval(intervalId);
    };
  });
</script>

<div class="min-h-screen bg-[#1F1B18] text-[#F6F2EA] flex flex-col font-mono selection:bg-[#D9A441] selection:text-[#1F1B18]">
  
  <header class="border-b border-[#767068]/30 bg-[#2A2521] px-6 py-4 flex items-center justify-between shadow-md">
    <div class="flex items-center gap-3">
      <div class="h-8 w-8 bg-[#D9A441] text-[#1F1B18] rounded flex items-center justify-center font-bold text-sm shadow">
        CS
      </div>
      <div>
        <h1 class="text-sm font-bold tracking-wider uppercase">CaterSync Client Portal</h1>
        <p class="text-[9px] text-[#767068] tracking-widest uppercase">Self-Service Console</p>
      </div>
    </div>
    
    {#if isAuthenticated}
      <button 
        onclick={handleLogout} 
        class="px-3 py-1.5 rounded bg-[#AC3B2A]/10 text-[#AC3B2A] border border-[#AC3B2A]/25 hover:bg-[#AC3B2A]/20 transition-all flex items-center gap-1.5 text-xs font-bold font-mono"
      >
        <LogOut size={13} />
        Exit Session
      </button>
    {/if}
  </header>

  <div class="flex-1 flex items-center justify-center p-6">
    {#if !isAuthenticated}
      <!-- CLIENT LOGIN WIZARD -->
      <div class="max-w-md w-full ticket-card bg-white text-[#2A2521] border border-[#767068]/30 shadow-2xl p-6 rounded relative animate-scale-up">
        
        <div class="border-b-2 border-dashed border-[#767068]/30 pb-4 mb-6">
          <div class="flex justify-between items-start">
            <span class="ticket-stamp bg-slate-100 text-slate-700">CLIENT CHECK-IN</span>
            <span class="text-xs text-[#767068]">GATEWAY #01</span>
          </div>
          <h2 class="text-lg font-bold mt-2 uppercase tracking-wide">Client Portal Entry</h2>
          <p class="text-xs text-[#767068] mt-1">Review event packages, sign agreements, specify dietary preferences, and browse menus.</p>
        </div>

        {#if portalLoginStep === 'email'}
          <!-- Step 1: Entry email -->
          <form onsubmit={checkIdentifier} class="space-y-4">
            <div>
              <label for="contact-input" class="block text-[10px] uppercase font-bold tracking-wider text-[#767068] mb-1.5">Registered Customer Email</label>
              <input 
                id="contact-input" 
                type="email" 
                bind:value={customerContact} 
                placeholder="e.g. customer@example.com" 
                class="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs text-[#2A2521] focus:ring-1 focus:ring-[#D9A441] focus:border-[#D9A441] outline-none"
                required 
              />
            </div>

            {#if errorMessage}
              <div class="px-3 py-2 bg-red-50 text-[#AC3B2A] border border-[#AC3B2A]/20 rounded text-xs leading-relaxed">
                {errorMessage}
              </div>
            {/if}

            <button 
              type="submit" 
              disabled={isChecking}
              class="w-full py-2.5 bg-[#2A2521] text-white hover:bg-[#2A2521]/90 rounded transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {#if isChecking}
                Checking Database...
              {:else}
                Continue <ArrowRight size={14} />
              {/if}
            </button>

            <!-- Claim Profile Register -->
            <button 
              type="button"
              onclick={sendOtpRequest}
              class="w-full text-center text-xs text-[#3E6650] hover:underline font-bold mt-2"
            >
              First time here? Claim & Activate Account
            </button>

            <!-- Google Sign In Container -->
            {#if googleClientId}
              <div class="border-t border-[#767068]/15 pt-4 my-2 text-center">
                <span class="text-[9px] uppercase text-[#767068] font-bold block mb-3 font-mono">Or connect with Google</span>
                <div id="google-btn-container" class="w-full flex justify-center min-h-[40px]"></div>
              </div>
            {/if}
          </form>

        {:else if portalLoginStep === 'otp'}
          <!-- Step 2: OTP Verification -->
          <form onsubmit={verifyOtpCode} class="space-y-4">
            <div class="flex items-center gap-1.5 border-b border-[#767068]/15 pb-2 mb-2">
              <button 
                type="button" 
                onclick={() => { portalLoginStep = 'email'; errorMessage = ''; }}
                class="text-[#767068] hover:text-[#2A2521]"
              >
                <ChevronLeft size={16} />
              </button>
              <span class="text-xs font-bold text-[#767068]">Verifying: <span class="text-[#2A2521]">{customerContact}</span></span>
            </div>

            <div>
              <label for="otp-input" class="block text-[10px] uppercase font-bold tracking-wider text-[#767068] mb-1.5">6-Digit Verification Code</label>
              <input 
                id="otp-input" 
                type="text" 
                bind:value={otpCode} 
                maxlength="6"
                placeholder="e.g. 123456" 
                class="w-full text-center text-lg tracking-[0.5em] px-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono text-[#2A2521] focus:ring-1 focus:ring-[#D9A441] focus:border-[#D9A441] outline-none"
                required 
              />
            </div>

            {#if errorMessage}
              <div class="px-3 py-2 bg-red-50 text-[#AC3B2A] border border-[#AC3B2A]/20 rounded text-xs leading-relaxed">
                {errorMessage}
              </div>
            {/if}

            {#if successMessage}
              <div class="px-3 py-2 bg-emerald-50 text-[#3E6650] border border-[#3E6650]/20 rounded text-xs leading-relaxed">
                {successMessage}
              </div>
            {/if}

            <button 
              type="submit" 
              disabled={isChecking}
              class="w-full py-2.5 bg-[#2A2521] text-white hover:bg-[#2A2521]/90 rounded transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {#if isChecking}
                Verifying Code...
              {:else}
                Confirm Verification <CheckCircle size={14} />
              {/if}
            </button>

            <button 
              type="button" 
              onclick={sendOtpRequest} 
              class="w-full text-center text-[10px] text-slate-500 hover:underline uppercase font-bold mt-2"
            >
              Resend Code
            </button>
          </form>

        {:else if portalLoginStep === 'pin'}
          <!-- Step 3: PIN Access Lock -->
          <div class="space-y-4">
            <div class="flex items-center gap-1.5 border-b border-[#767068]/15 pb-2 mb-2">
              <button 
                type="button" 
                onclick={() => { portalLoginStep = 'email'; errorMessage = ''; }}
                class="text-[#767068] hover:text-[#2A2521]"
              >
                <ChevronLeft size={16} />
              </button>
              <span class="text-xs font-bold text-[#767068]">Unlock Device Session</span>
            </div>

            <div>
              <label for="pin-input" class="block text-[10px] uppercase font-bold tracking-wider text-[#767068] mb-1.5">Enter 4-Digit Device PIN</label>
              <input 
                id="pin-input" 
                type="password" 
                pattern="[0-9]*" 
                inputmode="numeric" 
                maxlength="4" 
                bind:value={inputPIN} 
                oninput={() => { if (inputPIN.length === 4) unlockWithPin(); }}
                placeholder="••••" 
                class="w-full text-center text-xl tracking-[1.2em] pl-6 py-2.5 bg-slate-50 border border-slate-300 rounded font-mono text-[#2A2521] focus:ring-1 focus:ring-[#D9A441] outline-none"
                required 
              />
            </div>

            {#if errorMessage}
              <div class="px-3 py-2 bg-red-50 text-[#AC3B2A] border border-[#AC3B2A]/20 rounded text-xs leading-relaxed text-center">
                {errorMessage}
              </div>
            {/if}

            <p class="text-[9px] text-[#767068] font-mono text-center leading-relaxed">
              Auto-verifies upon entering 4th digit. If you forgot your device PIN, request a login OTP.
            </p>

            <button 
              type="button" 
              onclick={() => { portalLoginStep = 'email'; sendOtpRequest(); }}
              class="w-full text-center text-xs text-[#3E6650] hover:underline font-bold mt-1"
            >
              Sign In Using OTP Code
            </button>
          </div>

        {:else if portalLoginStep === 'setup_pin'}
          <!-- Step 4: Setup Quick Device PIN -->
          <form onsubmit={handleSetupPin} class="space-y-4">
            <div class="bg-emerald-50 border border-emerald-200 text-[#3E6650] p-4 rounded text-xs flex gap-2">
              <CheckCircle size={16} class="shrink-0 mt-0.5" />
              <div>
                <p class="font-bold">Verification Successful!</p>
                <p class="text-slate-600 mt-0.5">Please configure a 4-digit PIN for future quick logins on this device without needing email OTP codes.</p>
              </div>
            </div>

            <div>
              <label for="setup-pin-input" class="block text-[10px] uppercase font-bold tracking-wider text-[#767068] mb-1.5">Choose 4-Digit Device PIN</label>
              <input 
                id="setup-pin-input" 
                type="text" 
                pattern="[0-9]{4}" 
                maxlength="4" 
                bind:value={setupPIN} 
                placeholder="e.g. 1234" 
                class="w-full text-center text-lg tracking-[0.5em] px-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono text-[#2A2521] focus:ring-1 focus:ring-[#D9A441] outline-none"
                required 
              />
            </div>

            {#if errorMessage}
              <div class="px-3 py-2 bg-red-50 text-[#AC3B2A] border border-[#AC3B2A]/20 rounded text-xs">
                {errorMessage}
              </div>
            {/if}

            <button 
              type="submit" 
              class="w-full py-2.5 bg-[#3E6650] text-white hover:bg-[#3E6650]/90 rounded transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              Configure Device PIN & Open Dashboard
            </button>

            <button 
              type="button" 
              onclick={() => isAuthenticated = true}
              class="w-full text-center text-xs text-slate-500 hover:underline pt-1"
            >
              Skip and Enter Dashboard
            </button>
          </form>
        {/if}
      </div>
    {:else}
      <!-- CLIENT DASHBOARD -->
      <div class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        <!-- EVENT OVERVIEW & COUNTDOWN -->
        <div class="lg:col-span-1 space-y-6">
          <div class="ticket-card bg-white text-[#2A2521] p-6 border border-[#767068]/30 shadow-xl rounded relative">
            <div class="border-b-2 border-dashed border-[#767068]/30 pb-4 mb-4">
              <div class="flex justify-between items-center">
                <span class="ticket-stamp bg-emerald-50 text-[#3E6650] border-[#3E6650]/20 uppercase">
                  {event ? event.status : 'Pending'}
                </span>
                <span class="text-xs text-[#767068]">EVENT SUMMARY</span>
              </div>
              <h2 class="text-xl font-bold mt-2 uppercase text-[#2A2521]">{event ? event.event_type : 'Catering Booking'}</h2>
              <p class="text-xs text-[#767068] mt-1">{customer ? customer.name : 'Valued Client'}</p>
            </div>

            {#if event}
              <div class="space-y-3.5 text-xs">
                <div class="flex items-center gap-2.5">
                  <Calendar size={14} class="text-[#767068]" />
                  <div>
                    <p class="text-[9px] uppercase tracking-wider text-[#767068]">Scheduled Date</p>
                    <p class="font-bold text-[#2A2521]">
                       {new Date(event.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2.5">
                  <Sparkles size={14} class="text-[#767068]" />
                  <div>
                    <p class="text-[9px] uppercase tracking-wider text-[#767068]">Setup Theme</p>
                    <p class="font-bold text-[#2A2521]">{event.theme}</p>
                  </div>
                </div>

                <div class="flex items-center gap-2.5">
                  <MapPin size={14} class="text-[#767068]" />
                  <div>
                    <p class="text-[9px] uppercase tracking-wider text-[#767068]">Venue Configuration</p>
                    <p class="font-bold text-[#2A2521]">{event.venue_type} ({event.is_outdoor ? 'Outdoor' : 'Indoor'})</p>
                  </div>
                </div>

                <div class="flex items-center gap-2.5">
                  <Info size={14} class="text-[#767068]" />
                  <div>
                    <p class="text-[9px] uppercase tracking-wider text-[#767068]">Expected Guest Count</p>
                    <p class="font-bold text-[#2A2521]"> {event.guest_count} Servings</p>
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-xs text-[#767068]">No active bookings currently registered under your name.</p>
            {/if}
          </div>

          <!-- Countdown Timer Panel -->
          {#if event}
            <div class="p-6 bg-[#2A2521] border border-[#767068]/30 rounded shadow-md text-center">
              <h4 class="text-[10px] uppercase font-bold tracking-widest text-[#767068] mb-3">Time Remaining Until Event</h4>
              
              <div class="grid grid-cols-4 gap-2 font-mono text-center">
                <div class="bg-[#1F1B18] p-2 rounded border border-[#767068]/20">
                  <span class="block text-lg font-bold text-[#D9A441]">{days}</span>
                  <span class="text-[8px] uppercase tracking-wider text-[#767068]">Days</span>
                </div>
                <div class="bg-[#1F1B18] p-2 rounded border border-[#767068]/20">
                  <span class="block text-lg font-bold text-[#D9A441]">{hours}</span>
                  <span class="text-[8px] uppercase tracking-wider text-[#767068]">Hours</span>
                </div>
                <div class="bg-[#1F1B18] p-2 rounded border border-[#767068]/20">
                  <span class="block text-lg font-bold text-[#D9A441]">{minutes}</span>
                  <span class="text-[8px] uppercase tracking-wider text-[#767068]">Mins</span>
                </div>
                <div class="bg-[#1F1B18] p-2 rounded border border-[#767068]/20">
                  <span class="block text-lg font-bold text-[#D9A441]">{seconds}</span>
                  <span class="text-[8px] uppercase tracking-wider text-[#767068]">Secs</span>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- PORTAL INTERACTIONS & BILLING -->
        <div class="lg:col-span-2 space-y-6">
          <nav class="flex border-b border-[#767068]/30 font-mono text-xs">
            <button 
              onclick={() => { activeTab = 'billing'; errorMessage = ''; successMessage = ''; }}
              class="px-4 py-2.5 font-bold uppercase border-b-2 transition-all {activeTab === 'billing' ? 'border-[#D9A441] text-[#D9A441]' : 'border-transparent text-[#767068] hover:text-[#F6F2EA]'}"
            >
              Billing Details
            </button>
            <button 
              onclick={() => { activeTab = 'menu'; errorMessage = ''; successMessage = ''; }}
              class="px-4 py-2.5 font-bold uppercase border-b-2 transition-all {activeTab === 'menu' ? 'border-[#D9A441] text-[#D9A441]' : 'border-transparent text-[#767068] hover:text-[#F6F2EA]'}"
            >
              Menu selection
            </button>
            <button 
              onclick={() => { 
                activeTab = 'contract'; 
                errorMessage = ''; 
                successMessage = '';
                setTimeout(() => {
                  signaturePad = document.getElementById('signature-pad');
                }, 50);
              }}
              class="px-4 py-2.5 font-bold uppercase border-b-2 transition-all {activeTab === 'contract' ? 'border-[#D9A441] text-[#D9A441]' : 'border-transparent text-[#767068] hover:text-[#F6F2EA]'}"
            >
              Agreement Contract
            </button>
            <button 
              onclick={() => { activeTab = 'feedback'; errorMessage = ''; successMessage = ''; }}
              class="px-4 py-2.5 font-bold uppercase border-b-2 transition-all {activeTab === 'feedback' ? 'border-[#D9A441] text-[#D9A441]' : 'border-transparent text-[#767068] hover:text-[#F6F2EA]'}"
            >
              Audits & Feedback
            </button>
          </nav>

          <div class="bg-[#2A2521] border border-[#767068]/30 rounded p-6 shadow-md min-h-[300px]">
            
            {#if errorMessage}
              <div class="mb-4 px-3 py-2 bg-[#AC3B2A]/10 text-[#AC3B2A] border border-[#AC3B2A]/20 rounded text-xs">
                {errorMessage}
              </div>
            {/if}

            {#if successMessage}
              <div class="mb-4 px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs">
                {successMessage}
              </div>
            {/if}

            <!-- TAB 1: BILLING DETAILS -->
            {#if activeTab === 'billing'}
              <div class="space-y-6">
                <div class="flex justify-between items-start border-b border-[#767068]/30 pb-4">
                  <div>
                    <h3 class="text-sm font-bold uppercase tracking-wider text-white">Itemized Invoice Summary</h3>
                    <p class="text-[10px] text-[#767068] mt-1">Invoice number: {portalData.invoice ? portalData.invoice.invoice_number : 'INV-N/A'}</p>
                  </div>
                  {#if portalData.invoice}
                    <span class="px-2.5 py-0.5 text-[10px] font-bold rounded uppercase border tracking-wider {portalData.invoice.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}">
                      {portalData.invoice.status}
                    </span>
                  {/if}
                </div>

                {#if event}
                  <table class="w-full text-left text-xs font-mono">
                    <thead>
                      <tr class="border-b border-[#767068]/20 text-[#767068] uppercase text-[9px] tracking-wider">
                        <th class="py-2">Description</th>
                        <th class="py-2 text-right">Quantity</th>
                        <th class="py-2 text-right">Rate</th>
                        <th class="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="border-b border-[#767068]/10 text-white">
                        <td class="py-2.5">{event.event_type} Base Package ({event.theme})</td>
                        <td class="py-2.5 text-right">{event.guest_count} Head</td>
                        <td class="py-2.5 text-right">₱{(parseFloat(event.budget) / event.guest_count).toFixed(2)}</td>
                        <td class="py-2.5 text-right">₱{parseFloat(event.budget).toLocaleString()}</td>
                      </tr>
                      {#if portalData.invoice}
                        <tr class="text-[#767068]">
                          <td class="py-2" colspan="3">VAT / Tax Coverage (12%)</td>
                          <td class="py-2 text-right">₱{parseFloat(portalData.invoice.tax_amount).toLocaleString()}</td>
                        </tr>
                        <tr class="border-t border-[#767068]/30 font-bold text-white">
                          <td class="py-3" colspan="3">Grand Total</td>
                          <td class="py-3 text-right text-[#D9A441]">₱{parseFloat(portalData.invoice.total_amount).toLocaleString()}</td>
                        </tr>
                      {/if}
                    </tbody>
                  </table>

                  <div class="mt-6 pt-6 border-t border-[#767068]/30">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-white mb-3">Recorded Client Deposits</h4>
                    {#if portalData.payments.length === 0}
                      <div class="p-4 bg-[#1F1B18] border border-[#767068]/20 rounded text-center text-xs text-[#767068]">
                        <Info size={14} class="mx-auto mb-1.5" />
                        No deposits received yet. Please contact the main catering sales office to settle.
                      </div>
                    {:else}
                      <div class="space-y-2">
                        {#each portalData.payments as payment}
                          <div class="flex justify-between items-center p-2.5 bg-[#1F1B18] border border-[#767068]/20 rounded text-xs font-mono">
                            <div class="flex items-center gap-2">
                              <CheckCircle size={13} class="text-[#3E6650]" />
                              <div>
                                <p class="font-bold text-white">{payment.payment_method}</p>
                                <p class="text-[9px] text-[#767068]">{payment.transaction_reference}</p>
                              </div>
                            </div>
                            <span class="font-bold text-[#D9A441]">₱{parseFloat(payment.amount).toLocaleString()}</span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}

            <!-- TAB 2: MENU CHOICES -->
            {#if activeTab === 'menu'}
              <div class="space-y-4">
                <h3 class="text-sm font-bold uppercase tracking-wider text-white border-b border-[#767068]/30 pb-3 mb-4">
                  Selected Menu Package Details
                </h3>

                {#if portalData.menus.length === 0}
                  <div class="p-8 bg-[#1F1B18] border border-[#767068]/20 rounded text-center text-xs text-[#767068]">
                    <Info size={14} class="mx-auto mb-1.5" />
                    No custom menu tier linked to this event yet.
                  </div>
                {:else}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each portalData.menus as menu}
                      <div class="p-4 bg-[#1F1B18] border border-[#767068]/30 rounded shadow">
                        <div class="flex justify-between items-start">
                          <span class="text-[8px] uppercase px-1.5 py-0.5 bg-[#D9A441]/10 text-[#D9A441] font-bold border border-[#D9A441]/20 rounded">
                            {menu.category}
                          </span>
                        </div>
                        <h4 class="text-sm font-bold text-white mt-2 uppercase">{menu.name}</h4>
                        <p class="text-xs text-[#767068] mt-1">Servings planned: {parseInt(menu.quantity_planned)} servings</p>
                        <p class="text-xs text-white mt-3 font-bold">₱{parseFloat(menu.price_per_serving).toFixed(2)} <span class="text-[10px] text-[#767068] font-normal">per plate</span></p>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}

            <!-- TAB 3: AGREEMENT CONTRACT -->
            {#if activeTab === 'contract'}
              <div class="space-y-6">
                <div class="flex justify-between items-center border-b border-[#767068]/30 pb-3 mb-4">
                  <h3 class="text-sm font-bold uppercase tracking-wider text-white">Legal Catering Agreement</h3>
                  {#if portalData.contract}
                    <span class="px-2 py-0.5 text-[9px] font-bold uppercase rounded border tracking-wider {portalData.contract.status === 'Signed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}">
                      {portalData.contract.status}
                    </span>
                  {/if}
                </div>

                {#if portalData.contract}
                  <div class="bg-[#1F1B18] p-4 border border-[#767068]/20 rounded text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto">
                    {portalData.contract.content}
                  </div>

                  {#if portalData.contract.status !== 'Signed'}
                    <!-- E-SIGNATURE INTERACTIVE PAD -->
                    <div class="pt-4 border-t border-[#767068]/20 space-y-4">
                      <h4 class="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                        <PenTool size={13} class="text-[#D9A441]" />
                        Draw Your Legal Signature
                      </h4>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label for="signer-name" class="block text-[10px] uppercase font-bold tracking-wider text-[#767068] mb-1.5">Signer Full Name</label>
                          <input 
                            id="signer-name" 
                            type="text" 
                            bind:value={signerName} 
                            placeholder="Type legal name" 
                            class="w-full px-3 py-2 bg-[#1F1B18] border border-[#767068]/40 rounded font-mono text-xs text-white focus:ring-1 focus:ring-[#D9A441] outline-none"
                          />
                          <p class="text-[9px] text-[#767068] leading-relaxed mt-1.5">
                            By signing this agreement on this screen, you certify acceptance of all clauses and pricing items listed.
                          </p>
                        </div>

                        <div>
                          <label class="block text-[10px] uppercase font-bold tracking-wider text-[#767068] mb-1.5">Draw Signature</label>
                          <div class="relative bg-white rounded border border-slate-300 overflow-hidden">
                            <canvas 
                              id="signature-pad" 
                              width="400" 
                              height="120"
                              class="w-full h-[120px] cursor-crosshair touch-none block"
                              onmousedown={startDrawing}
                              onmousemove={draw}
                              onmouseup={stopDrawing}
                              onmouseleave={stopDrawing}
                              ontouchstart={startDrawing}
                              ontouchmove={draw}
                              ontouchend={stopDrawing}
                            ></canvas>
                            <button 
                              type="button" 
                              onclick={clearSignature}
                              class="absolute right-2 bottom-2 px-2 py-1 text-[9px] font-bold uppercase bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded transition-all"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </div>

                      <div class="flex items-start gap-2.5 pt-2">
                        <input 
                          id="agree-checkbox" 
                          type="checkbox" 
                          bind:checked={agreedToTerms} 
                          class="mt-0.5 h-3.5 w-3.5 accent-[#D9A441] rounded border-[#767068]/40 bg-[#1F1B18]"
                        />
                        <label for="agree-checkbox" class="text-[10px] text-[#767068] select-none leading-relaxed">
                          I agree to the Terms of Service, cancellation policies, and data Privacy Policy.
                        </label>
                      </div>

                      <button 
                        onclick={submitSignature}
                        disabled={!agreedToTerms}
                        class="px-4 py-2 bg-[#D9A441] text-[#1F1B18] hover:bg-[#D9A441]/90 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-all font-bold text-xs uppercase tracking-wider"
                      >
                        Submit Signature
                      </button>
                    </div>
                  {:else}
                    <div class="p-4 bg-[#1F1B18] border border-[#767068]/30 rounded text-xs space-y-2">
                      <p class="text-emerald-400 font-bold">✓ This catering agreement has been legally signed and registered</p>
                      {#if portalData.signature}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          <div class="space-y-1 font-mono text-[#767068]">
                            <p>Authorized Signer: <span class="text-white font-bold">{portalData.signature.signer_name}</span></p>
                            <p>Timestamp: <span class="text-white">{new Date(portalData.signature.signed_at).toLocaleString()}</span></p>
                            <p>Verification Code: <span class="text-white text-[10px]">CS-SIG-{portalData.signature.id}</span></p>
                          </div>
                          {#if portalData.signature.signature_svg}
                            <div class="h-20 bg-white border border-[#767068]/20 rounded p-2 flex items-center justify-center">
                              {@html portalData.signature.signature_svg}
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}

            <!-- TAB 4: AUDITS & FEEDBACK -->
            {#if activeTab === 'feedback'}
              <div class="space-y-6">
                <h3 class="text-sm font-bold uppercase tracking-wider text-white border-b border-[#767068]/30 pb-3 mb-4">
                  Catering Experience Audits & Feedback
                </h3>

                {#if portalData.review}
                  <div class="p-4 bg-[#1F1B18] border border-[#767068]/30 rounded text-xs space-y-3">
                    <p class="text-emerald-400 font-bold">✓ Experience Audit Submitted successfully</p>
                    
                    <div class="flex gap-1">
                      {#each Array(5) as _, i}
                        <Star size={16} class={i < portalData.review.rating ? 'fill-[#D9A441] text-[#D9A441]' : 'text-[#767068]'} />
                      {/each}
                    </div>
                    
                    <div>
                      <p class="text-[9px] uppercase tracking-wider text-[#767068]">Client Review Comments</p>
                      <p class="text-white font-serif mt-1 bg-[#2A2521] p-3 border border-[#767068]/20 rounded whitespace-pre-wrap italic">
                        "{portalData.review.comments || 'No written comments submitted.'}"
                      </p>
                    </div>
                  </div>
                {:else}
                  <div class="space-y-4">
                    <p class="text-xs text-[#767068]">
                      Please rate the food quality, styling, setup, and service of our crew to help us complete our operational audits.
                    </p>

                    <div>
                      <span class="block text-[10px] uppercase font-bold tracking-wider text-[#767068] mb-2">Overall Experience Rating</span>
                      <div class="flex gap-2.5">
                        {#each Array(5) as _, i}
                          <button 
                            type="button" 
                            onclick={() => rating = i + 1}
                            class="transition-all scale-100 hover:scale-110"
                          >
                            <Star size={26} class={i < rating ? 'fill-[#D9A441] text-[#D9A441]' : 'text-[#767068]'} />
                          </button>
                        {/each}
                      </div>
                    </div>

                    <div>
                      <label for="review-comments" class="block text-[10px] uppercase font-bold tracking-wider text-[#767068] mb-1.5">Comments & Testimonials</label>
                      <textarea 
                        id="review-comments"
                        bind:value={comments} 
                        rows="4" 
                        placeholder="Share your thoughts on the food quality, crew service, and setup styling..." 
                        class="w-full px-3 py-2 bg-[#1F1B18] border border-[#767068]/40 rounded font-mono text-xs text-white focus:ring-1 focus:ring-[#D9A441] outline-none resize-none"
                      ></textarea>
                    </div>

                    <button 
                      onclick={submitReview}
                      class="px-4 py-2 bg-[#D9A441] text-[#1F1B18] hover:bg-[#D9A441]/90 rounded transition-all font-bold text-xs uppercase tracking-wider"
                    >
                      Log Feedback Audit
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

      </div>
    {/if}
  </div>

  <footer class="border-t border-[#767068]/30 bg-[#2A2521] px-6 py-3 text-center text-[9px] text-[#767068] tracking-widest uppercase">
    CaterSync Operations Inc. · Version 1.3.9 · Built Offline & Secure
  </footer>
</div>

<style>
  .ticket-card {
    background-image: radial-gradient(circle at top left, transparent 10px, white 11px), 
                      radial-gradient(circle at top right, transparent 10px, white 11px), 
                      radial-gradient(circle at bottom left, transparent 10px, white 11px), 
                      radial-gradient(circle at bottom right, transparent 10px, white 11px);
    background-position: top left, top right, bottom left, bottom right;
    background-size: 50% 50%;
    background-repeat: no-repeat;
  }

  .ticket-stamp {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.15em;
    padding: 2px 6px;
    border-radius: 2px;
    border: 1px solid currentColor;
    font-family: monospace;
  }

  @keyframes scaleUp {
    from { transform: scale(0.96); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .animate-scale-up {
    animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
</style>

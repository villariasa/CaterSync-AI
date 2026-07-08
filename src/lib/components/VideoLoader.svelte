<script>
  /**
   * VideoLoader — Full-screen overlay with loader.mp4 on a white background.
   * Usage: {#if isLoading}<VideoLoader />{/if}
   */
  let { message = '' } = $props();
</script>

<div
  class="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-[#e8e4de]"
  style="animation: vloader-fadein 0.15s ease-out;"
>
  <video
    autoplay
    muted
    loop
    playsinline
    style="width: 200px; height: 200px; object-fit: cover; display: block; mix-blend-mode: multiply; -webkit-mask-image: radial-gradient(circle, black 52%, transparent 68%); mask-image: radial-gradient(circle, black 52%, transparent 68%); overflow: hidden;"
  >
    <source src="/loader.mp4" type="video/mp4" />
  </video>
  {#if message}
    <p style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #767068; margin-top: 12px;">
      {message}
    </p>
  {/if}
</div>

<style>
  @keyframes vloader-fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>

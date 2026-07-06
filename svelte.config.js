import adapter from '@sveltejs/adapter-static';

export default {
  compilerOptions: {
    runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
  },
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    })
  }
};

import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterNode from '@sveltejs/adapter-node';

const isDev = !process.env.CF_PAGES;

export default {
  kit: {
    adapter: isDev ? adapterNode() : adapterCloudflare()
  }
};


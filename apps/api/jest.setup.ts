for (const key of ['BRAVE_SEARCH_API_KEY', 'SERPER_API_KEY', 'TAVILY_API_KEY']) {
  delete process.env[key];
}

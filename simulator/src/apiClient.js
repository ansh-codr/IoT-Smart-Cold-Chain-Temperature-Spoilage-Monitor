export class ApiClient {
  constructor(baseUrl, realOffline) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.realOffline = realOffline;
  }

  async getProfiles() {
    try {
      const res = await fetch(`${this.baseUrl}/api/profiles`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (this.realOffline) return null;
      console.warn('Failed to fetch profiles:', e.message);
      return null;
    }
  }

  async postReadings(readings) {
    // If realOffline is enabled, maybe we simulate network error or let fetch throw
    const res = await fetch(`${this.baseUrl}/api/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readings)
    });
    
    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }
    return await res.json();
  }
}

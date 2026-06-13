/**
 * Fetch utility with exponential backoff retry logic for external APIs.
 * Resolves temporary network errors (e.g. timeouts) and 5xx server status codes.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = 3,
  delay: number = 1000
): Promise<Response> {
  let attempt = 0;
  
  while (true) {
    try {
      const res = await fetch(url, options);
      
      // If the response is OK, or if it is a client-side error (4xx) which retries won't fix
      if (res.ok || res.status < 500) {
        return res;
      }
      
      // If it's a server error (5xx), we retry
      throw new Error(`Server returned status ${res.status}`);
      
    } catch (err: any) {
      attempt++;
      if (attempt > retries) {
        console.error(`[fetchWithRetry] Final failure calling ${url} after ${retries} attempts. Error:`, err.message);
        throw err;
      }
      
      const nextDelay = delay * Math.pow(2, attempt - 1);
      console.warn(`[fetchWithRetry] Attempt ${attempt} failed calling ${url}. Retrying in ${nextDelay}ms... Error:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, nextDelay));
    }
  }
}

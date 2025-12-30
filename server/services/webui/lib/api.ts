export const API_URL = '/api';

export async function fetchApi(endpoint: string, secretKey: string, options: RequestInit = {}) {
    const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-secret-key': secretKey,
            ...options.headers,
        },
    });

    try {
        if (!res.ok) {
            const text = await res.text();
            let errorMessage = `HTTP ${res.status}`;
            try {
                const json = JSON.parse(text);
                if (json.error) errorMessage = json.error;
            } catch {
                errorMessage = `${errorMessage}: ${text}`;
            }
            throw new Error(errorMessage);
        }

        return res.json();
    } catch (e: any) {
        // If it's a fetch failure (e.g. network error)
        if (e.name === 'TypeError' && e.message === 'fetch failed') {
            throw new Error('Network Error: Failed to reach server.');
        }
        throw e;
    }
}

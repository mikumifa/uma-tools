import { createContext } from 'preact';

const defaultLanguage = 'cn';

export const Language = createContext(defaultLanguage);

export function useLanguage() {
	// CN-only app, so the language never changes.
	return defaultLanguage;
}

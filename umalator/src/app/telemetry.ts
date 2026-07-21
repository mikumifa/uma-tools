import posthog from 'posthog-js';

export function initTelemetry() {
	if (CC_GLOBAL && !CC_DEBUG) {
		posthog.init('phc_rmAEubU5JeFpYm6HSMhR8cpe6nbY6eR94jwOpQt0kzt', {
			api_host: 'https://us.i.posthog.com',
			person_profiles: 'identified_only',  // or 'always' to create profiles for anonymous users as well
			loaded: function (posthog) {
				window.posthog = posthog;
			},
			autocapture: {
				dom_event_allowlist: ['click'],
				element_allowlist: ['a', 'button', 'select']
			}
		});
	}
}

export function postEvent(event, obj) {
	if (CC_GLOBAL && !CC_DEBUG) {
		posthog.capture(event, obj);
	}
}

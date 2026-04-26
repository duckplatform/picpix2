'use strict';

const DEFAULT_EVENT_TRANSITION = 'fade';

const EVENT_TRANSITIONS = {
  fade: {
    key: 'fade',
    label: 'Fondu',
  },
  slide: {
    key: 'slide',
    label: 'Glissement',
  },
  zoom: {
    key: 'zoom',
    label: 'Zoom doux',
  },
  cut: {
    key: 'cut',
    label: 'Coupe franche',
  },
};

function listTransitions() {
  return Object.values(EVENT_TRANSITIONS);
}

function normalizeTransitionKey(value) {
  if (!value || typeof value !== 'string') {
    return DEFAULT_EVENT_TRANSITION;
  }

  const trimmed = value.trim().toLowerCase();
  return EVENT_TRANSITIONS[trimmed] ? trimmed : DEFAULT_EVENT_TRANSITION;
}

module.exports = {
  DEFAULT_EVENT_TRANSITION,
  EVENT_TRANSITIONS,
  listTransitions,
  normalizeTransitionKey,
};

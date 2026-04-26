(function initProfileEventModeration() {
  'use strict';

  const shell = document.getElementById('moderation-shell');
  if (!shell) {
    return;
  }

  const eventId = Number.parseInt(shell.dataset.eventId || '', 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return;
  }

  const grid = document.getElementById('moderation-pending-grid');
  const emptyState = document.getElementById('moderation-empty');

  if (!grid || !emptyState) {
    return;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateStr) {
    if (!dateStr) {
      return '';
    }

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString('fr-FR');
  }

  function syncEmptyState() {
    const hasCards = Boolean(grid.querySelector('[data-file-id]'));
    grid.hidden = !hasCards;
    emptyState.hidden = hasCards;
  }

  function findCardByPayload(payload) {
    if (!payload) {
      return null;
    }

    if (payload.fileId) {
      const byId = grid.querySelector('[data-file-id="' + String(payload.fileId) + '"]');
      if (byId) {
        return byId;
      }
    }

    if (payload.storedName) {
      return grid.querySelector('[data-stored-name="' + String(payload.storedName) + '"]');
    }

    return null;
  }

  function removeCard(payload) {
    const card = findCardByPayload(payload);
    if (!card) {
      return;
    }

    card.remove();
    syncEmptyState();
  }

  function buildActionForm(actionUrl, fileId, csrfToken, moderationStatus, label, isDanger) {
    return ''
      + '<form method="post" action="' + escapeHtml(actionUrl) + '" class="inline-form js-moderation-action-form" data-file-id="' + String(fileId) + '">'
      + '<input type="hidden" name="_csrf" value="' + escapeHtml(csrfToken) + '" />'
      + '<input type="hidden" name="moderationStatus" value="' + escapeHtml(moderationStatus) + '" />'
      + '<button class="btn ' + (isDanger ? 'btn-danger ' : '') + 'btn-small" type="submit">' + escapeHtml(label) + '</button>'
      + '</form>';
  }

  function createCard(payload) {
    const actionUrlBase = '/profile/event/' + String(eventId) + '/moderation/' + String(payload.fileId);
    const imageUrl = (payload.urls && (payload.urls.sm || payload.urls.md || payload.urls.original))
      || ('/profile/events/' + String(eventId) + '/photos/' + String(payload.storedName) + '/sm');
    const originalUrl = (payload.urls && payload.urls.original)
      || ('/profile/events/' + String(eventId) + '/photos/' + String(payload.storedName) + '/original');

    const firstForm = grid.querySelector('.js-moderation-action-form');
    const csrfInput = firstForm ? firstForm.querySelector('input[name="_csrf"]') : null;
    const csrfToken = csrfInput ? csrfInput.value : '';

    const article = document.createElement('article');
    article.className = 'event-gallery-card';
    article.setAttribute('data-file-id', String(payload.fileId));
    article.setAttribute('data-stored-name', String(payload.storedName));

    const uploaderName = payload.uploaderName || 'Visiteur';

    article.innerHTML = ''
      + '<a href="' + escapeHtml(originalUrl) + '" target="_blank" rel="noopener noreferrer">'
      + '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(payload.originalName || payload.storedName) + '" loading="lazy" />'
      + '</a>'
      + '<div class="event-gallery-meta">'
      + '<strong>' + escapeHtml(payload.originalName || payload.storedName) + '</strong>'
      + '<small>En attente d\'approbation</small>'
      + '<small>Par ' + escapeHtml(uploaderName) + ' · ' + escapeHtml(formatDate(payload.uploadedAt)) + '</small>'
      + '</div>'
      + '<div class="table-actions">'
      + buildActionForm(actionUrlBase, payload.fileId, csrfToken, 'approved', 'Approuver', false)
      + buildActionForm(actionUrlBase, payload.fileId, csrfToken, 'rejected', 'Rejeter', true)
      + '</div>';

    const imageEl = article.querySelector('img');
    if (imageEl) {
      imageEl.onerror = function onImageError() {
        imageEl.onerror = null;
        imageEl.src = originalUrl;
      };
    }

    return article;
  }

  function upsertPendingCard(payload) {
    if (!payload || Number(payload.eventId) !== eventId) {
      return;
    }

    if (payload.moderationStatus && payload.moderationStatus !== 'pending') {
      removeCard(payload);
      return;
    }

    const existing = findCardByPayload(payload);
    if (existing) {
      return;
    }

    const card = createCard(payload);
    grid.prepend(card);
    syncEmptyState();
  }

  function submitActionForm(form) {
    const formData = new FormData(form);

    return fetch(form.action, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData,
    }).then(function onResponse(response) {
      if (!response.ok) {
        throw new Error('La moderation a echoue.');
      }

      return response.json();
    }).then(function onJson(payload) {
      removeCard({ fileId: form.getAttribute('data-file-id') });
      return payload;
    }).catch(function onError() {
      // Fallback robuste: submit HTML classique si la requête AJAX échoue.
      form.submit();
    });
  }

  document.addEventListener('submit', function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('js-moderation-action-form')) {
      return;
    }

    event.preventDefault();
    void submitActionForm(form);
  });

  if (typeof window.io === 'function') {
    const socket = window.io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.emit('moderation:join', { eventId: eventId });

    socket.on('moderation:pending-photo', function onPendingPhoto(payload) {
      upsertPendingCard(payload);
    });

    socket.on('moderation:photo-reviewed', function onReviewed(payload) {
      if (!payload || Number(payload.eventId) !== eventId) {
        return;
      }

      removeCard(payload);
    });
  }

  syncEmptyState();
}());

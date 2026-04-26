/**
 * camera.js — Modal caméra embarquée
 *
 * Fournit une interface plein-écran permettant à l'utilisateur de prendre
 * plusieurs photos via l'appareil photo du téléphone (flux getUserMedia),
 * de les visionner en vignettes, puis de les valider pour les injecter dans
 * l'instance Dropzone de la page d'upload.
 *
 * Dépendance : window.dropzoneInstance doit être exposé par event-upload.js
 *              avant l'initialisation de ce module.
 */
(function initCameraModule() {
  'use strict';

  // ── Références DOM ──────────────────────────────────────────────────────────
  const openBtn = document.getElementById('camera-open-btn');
  const modal = document.getElementById('camera-modal');

  // La caméra n'est disponible que si le navigateur le supporte ET que les
  // éléments DOM nécessaires sont présents.
  if (!openBtn || !modal) {
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Cache le bouton si getUserMedia n'est pas disponible (navigateur ancien)
    openBtn.style.display = 'none';
    return;
  }

  const videoEl = document.getElementById('camera-video');
  const canvasEl = document.getElementById('camera-canvas');
  const captureBtn = document.getElementById('camera-capture-btn');
  const validateBtn = document.getElementById('camera-validate-btn');
  const cancelBtn = document.getElementById('camera-cancel-btn');
  const thumbnailsEl = document.getElementById('camera-thumbnails');
  const counterEl = document.getElementById('camera-counter');
  const switchBtn = document.getElementById('camera-switch-btn');
  const allowMultipleInput = document.getElementById('upload-allow-multiple');

  const allowMultiple = !allowMultipleInput || allowMultipleInput.value === '1';

  // ── État interne ────────────────────────────────────────────────────────────
  let stream = null;
  let capturedBlobs = [];
  let streamStopTimer = null;
  // 'environment' = caméra arrière (défaut mobile), 'user' = caméra avant
  let facingMode = 'environment';

  function cancelScheduledStop() {
    if (streamStopTimer) {
      clearTimeout(streamStopTimer);
      streamStopTimer = null;
    }
  }

  function scheduleStopStream(delayMs) {
    cancelScheduledStop();
    streamStopTimer = setTimeout(function stopLater() {
      stopStream();
    }, delayMs);
  }

  async function getCameraPermissionState() {
    if (!navigator.permissions || !navigator.permissions.query) {
      return 'unknown';
    }

    try {
      const status = await navigator.permissions.query({ name: 'camera' });
      return status && status.state ? status.state : 'unknown';
    } catch (err) {
      return 'unknown';
    }
  }

  // ── Gestion du flux caméra ──────────────────────────────────────────────────

  /**
   * Démarre le flux vidéo avec le facingMode courant.
   * Si le flux précédent existe, on l'arrête d'abord.
   */
  async function startStream(options) {
    const forceRestart = Boolean(options && options.forceRestart);

    if (stream && !forceRestart) {
      videoEl.srcObject = stream;
      await videoEl.play();
      return;
    }

    if (stream) {
      stopStream();
    }

    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = stream;
      await videoEl.play();
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        showCameraError('Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur puis réessayez.');
        return;
      }

      showCameraError('Impossible d\'accéder à la caméra : ' + err.message);
    }
  }

  /** Arrête le flux et vide srcObject. */
  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(function stopTrack(t) { t.stop(); });
      stream = null;
    }
    videoEl.srcObject = null;
  }

  // ── Capture ─────────────────────────────────────────────────────────────────

  /** Capture le frame courant de la vidéo, l'ajoute à capturedBlobs. */
  function capturePhoto() {
    if (!stream) {
      return;
    }

    // S'assurer que la vidéo a bien des données à afficher
    if (videoEl.readyState < 2 || videoEl.videoWidth === 0) {
      return;
    }

    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    canvasEl.width = width;
    canvasEl.height = height;

    const ctx = canvasEl.getContext('2d');
    // Fond blanc pour éviter les vignettes noires sur fond transparent
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(videoEl, 0, 0, width, height);

    canvasEl.toBlob(
      function onBlob(blob) {
        if (!blob) {
          return;
        }
        const index = capturedBlobs.length;
        capturedBlobs.push(blob);
        renderThumbnail(blob, index);
        updateCounter();
        updateValidateBtn();
      },
      'image/jpeg',
      0.9,
    );
  }

  // ── Vignettes ────────────────────────────────────────────────────────────────

  /**
   * Affiche une vignette dans le bandeau avec un bouton de suppression.
   * @param {Blob} blob
   * @param {number} index
   */
  function renderThumbnail(blob, index) {
    const objectUrl = URL.createObjectURL(blob);
    const item = document.createElement('div');
    item.className = 'camera-thumb';
    item.dataset.index = index;

    const img = document.createElement('img');
    img.src = objectUrl;
    img.alt = 'Photo ' + (index + 1);
    // Libère l'URL objet une fois l'image chargée
    img.addEventListener('load', function freeUrl() {
      URL.revokeObjectURL(objectUrl);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'camera-thumb-remove';
    removeBtn.setAttribute('aria-label', 'Supprimer la photo ' + (index + 1));
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', function removePhoto() {
      capturedBlobs[index] = null;
      item.remove();
      updateCounter();
      updateValidateBtn();
    });

    item.appendChild(img);
    item.appendChild(removeBtn);
    thumbnailsEl.appendChild(item);
  }

  /** Met à jour le compteur de photos. */
  function updateCounter() {
    const count = capturedBlobs.filter(Boolean).length;
    counterEl.textContent = count === 0
      ? 'Aucune photo'
      : count + ' photo' + (count > 1 ? 's' : '');
  }

  /** Active/désactive le bouton Valider selon le nombre de photos. */
  function updateValidateBtn() {
    const count = capturedBlobs.filter(Boolean).length;
    validateBtn.disabled = count === 0;
    validateBtn.textContent = count === 0
      ? 'Valider et envoyer'
      : 'Valider et envoyer (' + count + ' photo' + (count > 1 ? 's' : '') + ')';
  }

  // ── Messages d'erreur ────────────────────────────────────────────────────────

  function showCameraError(message) {
    const errEl = document.getElementById('camera-error');
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = 'block';
    }
  }

  function clearCameraError() {
    const errEl = document.getElementById('camera-error');
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  // ── Ouverture / fermeture modal ──────────────────────────────────────────────

  async function openModal() {
    capturedBlobs = [];
    thumbnailsEl.innerHTML = '';
    clearCameraError();
    updateCounter();
    updateValidateBtn();
    captureBtn.disabled = false;
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    cancelScheduledStop();

    const permissionState = await getCameraPermissionState();
    if (permissionState === 'denied') {
      showCameraError('La caméra est bloquée pour ce site. Ouvrez les permissions du navigateur et autorisez la caméra.');
      return;
    }

    await startStream({ forceRestart: false });
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    // On garde temporairement le flux pour éviter de redemander la permission
    // si l'utilisateur rouvre la caméra juste après.
    scheduleStopStream(90 * 1000);
  }

  // ── Validation → injection dans Dropzone ────────────────────────────────────

  function validatePhotos() {
    const dz = window.dropzoneInstance;
    if (!dz) {
      showCameraError('L\'interface d\'upload n\'est pas prête. Rechargez la page.');
      return;
    }

    const validBlobs = capturedBlobs.filter(Boolean);
    if (validBlobs.length === 0) {
      return;
    }

    // Si mode mono-photo, on ne prend que la première
    const toUpload = allowMultiple ? validBlobs : [validBlobs[0]];

    toUpload.forEach(function addToDz(blob, i) {
      const timestamp = Date.now();
      const fileName = 'camera-' + timestamp + '-' + (i + 1) + '.jpg';
      const file = new File([blob], fileName, { type: 'image/jpeg', lastModified: timestamp });
      dz.addFile(file);
    });

    closeModal();
  }

  // ── Retournement caméra ─────────────────────────────────────────────────────

  function switchCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    void startStream({ forceRestart: true });
  }

  // ── Écouteurs d'événements ───────────────────────────────────────────────────

  openBtn.addEventListener('click', function onOpenClick() {
    void openModal();
  });
  cancelBtn.addEventListener('click', closeModal);
  captureBtn.addEventListener('click', capturePhoto);
  validateBtn.addEventListener('click', validatePhotos);
  switchBtn.addEventListener('click', switchCamera);

  // Fermeture par clic sur le fond du modal (hors contenu)
  modal.addEventListener('click', function onModalClick(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Fermeture avec Escape
  document.addEventListener('keydown', function onKeyDown(e) {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
      closeModal();
    }
  });

  document.addEventListener('visibilitychange', function onVisibilityChange() {
    if (document.hidden) {
      stopStream();
      return;
    }

    if (!modal.hasAttribute('hidden')) {
      void startStream({ forceRestart: false });
    }
  });

  window.addEventListener('pagehide', function onPageHide() {
    stopStream();
  });

  // En mode mono-photo : désactive le bouton Capturer après 1 prise
  if (!allowMultiple) {
    captureBtn.addEventListener('click', function limitOne() {
      if (capturedBlobs.filter(Boolean).length >= 1) {
        captureBtn.disabled = true;
      }
    });
  }
}());

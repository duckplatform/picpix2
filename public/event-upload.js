(function initEventUploadPage() {
  const dropzoneHost = document.getElementById('dropzone-uploader');
  if (!dropzoneHost || typeof window.Dropzone === 'undefined') {
    return;
  }

  window.Dropzone.autoDiscover = false;

  const csrfInput = document.getElementById('upload-csrf');
  const endpointInput = document.getElementById('upload-endpoint');
  const sourceModeInput = document.getElementById('upload-source-mode');
  const allowMultipleInput = document.getElementById('upload-allow-multiple');
  const feedback = document.getElementById('upload-feedback');
  const sourceMode = sourceModeInput ? sourceModeInput.value : 'default';
  const allowMultiple = !allowMultipleInput || allowMultipleInput.value === '1';
  const isCameraOnly = sourceMode === 'camera_only';
  const isLibraryOnly = sourceMode === 'library_only';

  let dashboardNote = 'Images uniquement, 10 Mo max par fichier.';
  if (isCameraOnly) {
    dashboardNote += ' Mode camera uniquement.';
  } else if (isLibraryOnly) {
    dashboardNote += ' Mode phototheque uniquement.';
  } else {
    dashboardNote += ' Compatible galerie + prise de vue mobile.';
  }

  dashboardNote += allowMultiple
    ? ' Plusieurs photos a la suite sont autorisees.'
    : ' Une seule photo a la fois est autorisee.';

  function renderMessage(message, type) {
    feedback.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  }

  const dropzone = new window.Dropzone(dropzoneHost, {
    url: endpointInput.value,
    autoProcessQueue: true,
    uploadMultiple: allowMultiple,
    parallelUploads: allowMultiple ? 10 : 1,
    maxFiles: allowMultiple ? 10 : 1,
    maxFilesize: 10,
    acceptedFiles: 'image/*',
    paramName: 'photos',
    clickable: true,
    addRemoveLinks: true,
    dictDefaultMessage: dashboardNote,
    dictRemoveFile: 'Retirer',
    headers: {
      'x-csrf-token': csrfInput.value,
    },
    init: function initDropzone() {
      const hiddenInput = this.hiddenFileInput;
      if (!hiddenInput) {
        return;
      }

      hiddenInput.setAttribute('accept', 'image/*');

      if (allowMultiple) {
        hiddenInput.setAttribute('multiple', 'multiple');
      } else {
        hiddenInput.removeAttribute('multiple');
      }

      if (isCameraOnly) {
        hiddenInput.setAttribute('capture', 'environment');
      } else {
        hiddenInput.removeAttribute('capture');
      }
    },
  });

  dropzone.on('error', function onError(file, message) {
    const text = typeof message === 'string' ? message : (message && message.message) || `Erreur d'upload sur ${file.name}.`;
    renderMessage(text, 'error');
  });

  dropzone.on('success', function onSuccess(file, response) {
    renderMessage((response && response.message) || `Photo televersee : ${file.name}`, 'success');
  });

  dropzone.on('successmultiple', function onSuccessMultiple(files, response) {
    if (!response || !Array.isArray(response.files)) {
      return;
    }

    renderMessage((response && response.message) || `${files.length} fichier(s) televerse(s) avec succes.`, 'success');
  });

  dropzone.on('maxfilesexceeded', function onMaxExceeded(file) {
    dropzone.removeFile(file);
    renderMessage('Trop de fichiers selectionnes pour cet evenement.', 'error');
  });

  // Expose l'instance pour camera.js
  window.dropzoneInstance = dropzone;
}());

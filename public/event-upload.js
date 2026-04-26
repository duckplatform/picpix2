(function initEventUploadPage() {
  const dashboardTarget = document.getElementById('uppy-dashboard');
  if (!dashboardTarget || typeof window.Uppy === 'undefined') {
    return;
  }

  const csrfInput = document.getElementById('upload-csrf');
  const endpointInput = document.getElementById('upload-endpoint');
  const sourceModeInput = document.getElementById('upload-source-mode');
  const allowMultipleInput = document.getElementById('upload-allow-multiple');
  const feedback = document.getElementById('upload-feedback');
  const uploadedFilesTableBody = document.getElementById('uploaded-files-table-body');
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

  function appendUploadedFileRow(fileItem) {
    if (!uploadedFilesTableBody) {
      return;
    }

    const row = document.createElement('tr');
    const createdAt = new Date(fileItem.createdAt).toLocaleString('fr-FR');
    row.innerHTML = `
      <td>${fileItem.originalName}</td>
      <td>${Math.round(fileItem.sizeBytes / 1024)} Ko</td>
      <td>${createdAt}</td>
    `;
    uploadedFilesTableBody.insertBefore(row, uploadedFilesTableBody.firstChild);
  }

  const uppy = new window.Uppy.Uppy({
    autoProceed: false,
    allowMultipleUploadBatches: allowMultiple,
    restrictions: {
      maxFileSize: 10 * 1024 * 1024,
      maxNumberOfFiles: allowMultiple ? 10 : 1,
      allowedFileTypes: ['image/*'],
    },
  });

  uppy.use(window.Uppy.Dashboard, {
    inline: true,
    target: '#uppy-dashboard',
    proudlyDisplayPoweredByUppy: false,
    showProgressDetails: true,
    note: dashboardNote,
    hideRetryButton: false,
    hidePauseResumeButton: true,
    doneButtonHandler: null,
    width: '100%',
    height: 460,
    disableLocalFiles: isCameraOnly,
  });

  if (!isLibraryOnly) {
    uppy.use(window.Uppy.Webcam, {
      target: window.Uppy.Dashboard,
      modes: ['picture'],
      mirror: false,
      showRecordingLength: false,
      showVideoSourceDropdown: true,
      videoConstraints: {
        facingMode: 'environment',
      },
    });
  }

  uppy.use(window.Uppy.XHRUpload, {
    endpoint: endpointInput.value,
    fieldName: 'photos',
    headers: {
      'x-csrf-token': csrfInput.value,
    },
    limit: 3,
  });

  uppy.on('upload-success', function onUploadSuccess(file, response) {
    if (response && response.body && Array.isArray(response.body.files)) {
      response.body.files.forEach(appendUploadedFileRow);
    }

    renderMessage((response && response.body && response.body.message) || `Photo envoyee : ${file.name}`, 'success');
  });

  uppy.on('upload-error', function onUploadError(file, error, response) {
    const responseMessage = response && response.body && response.body.message;
    renderMessage(responseMessage || error.message || `Erreur d'upload sur ${file.name}.`, 'error');
  });

  uppy.on('restriction-failed', function onRestrictionFailed(file, error) {
    renderMessage(error.message || `Fichier refuse : ${file.name}`, 'error');
  });
}());

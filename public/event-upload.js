(function initEventUploadPage() {
  const dashboardTarget = document.getElementById('uppy-dashboard');
  if (!dashboardTarget || typeof window.Uppy === 'undefined') {
    return;
  }

  const csrfInput = document.getElementById('upload-csrf');
  const endpointInput = document.getElementById('upload-endpoint');
  const feedback = document.getElementById('upload-feedback');
  const uploadedFilesTableBody = document.getElementById('uploaded-files-table-body');

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
    allowMultipleUploadBatches: true,
    restrictions: {
      maxFileSize: 10 * 1024 * 1024,
      maxNumberOfFiles: 10,
      allowedFileTypes: ['image/*'],
    },
  });

  uppy.use(window.Uppy.Dashboard, {
    inline: true,
    target: '#uppy-dashboard',
    proudlyDisplayPoweredByUppy: false,
    showProgressDetails: true,
    note: 'Images uniquement, 10 Mo max par fichier. Compatible galerie + prise de vue mobile.',
    hideRetryButton: false,
    hidePauseResumeButton: true,
    doneButtonHandler: null,
    width: '100%',
    height: 460,
  });

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

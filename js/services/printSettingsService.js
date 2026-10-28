/* =========================================================
   TUX POS — SHARED PRINT SETTINGS SERVICE

   Shared configuration:
   - Thermal Receipt
   - A4
   - Thermal widths: 58 mm, 72 mm, 80 mm, or custom

   Reads use the main Supabase client.
   Updates use the authenticated TUX Admin client.
   ========================================================= */

const TUX_PRINT_SETTINGS_DEFAULTS = Object.freeze({
  id: 1,
  print_format: 'thermal',
  thermal_width_mm: 80
});

let tuxPrintSettingsCache = {
  ...TUX_PRINT_SETTINGS_DEFAULTS
};


/* =========================================================
   NORMALIZE PRINT SETTINGS
   ========================================================= */

function normalizeTuxPrintSettings(settings) {
  const source =
    settings && typeof settings === 'object'
      ? settings
      : {};

  const format =
    String(source.print_format || 'thermal').toLowerCase();

  const width = Number(source.thermal_width_mm);

  return {
    id: 1,

    print_format:
      format === 'a4'
        ? 'a4'
        : 'thermal',

    thermal_width_mm:
      Number.isFinite(width) &&
      width >= 20 &&
      width <= 300
        ? width
        : 80
  };
}


/* =========================================================
   CHECK SUPABASE CLIENT AVAILABILITY
   ========================================================= */

function requirePrintSettingsClient(clientName) {
  const client =
    clientName === 'admin'
      ? window.tuxAdminAuthClient
      : window.supabaseClient;

  if (
    !client ||
    typeof client.from !== 'function'
  ) {
    throw new Error(
      'TUX POS: The required Supabase client is unavailable.'
    );
  }

  return client;
}


/* =========================================================
   LOAD SHARED SETTINGS FROM SUPABASE

   This performs a database read so printing can use the
   latest configuration shared across computers.
   ========================================================= */

async function getTuxPrintSettings() {
  const client =
    requirePrintSettingsClient('main');

  const {
    data,
    error
  } = await client
    .from('tux_print_settings')
    .select(
      'id, print_format, thermal_width_mm, updated_at'
    )
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error(
      'TUX POS — Could not load shared print settings:',
      error
    );

    throw new Error(
      'Could not load the shared print settings. ' +
      'Check the Supabase table and read policy.'
    );
  }

  if (!data) {
    throw new Error(
      'Shared print settings have not been initialized in Supabase.'
    );
  }

  tuxPrintSettingsCache =
    normalizeTuxPrintSettings(data);

  return {
    ...tuxPrintSettingsCache
  };
}


/* =========================================================
   UPDATE SETTINGS PANEL STATUS
   ========================================================= */

function setPrintSettingsStatus(message, color = '#9ca3af') {
  const status =
    document.getElementById('printSettingsStatus');

  if (!status) {
    return;
  }

  status.textContent = String(message || '');

  status.style.color = color;
}


/* =========================================================
   SHOW OR HIDE CUSTOM WIDTH INPUT
   ========================================================= */

function updateThermalWidthVisibility() {
  const preset =
    document.getElementById('thermalWidthPreset');

  const customGroup =
    document.getElementById('customThermalWidthGroup');

  if (!preset || !customGroup) {
    return;
  }

  customGroup.style.display =
    preset.value === 'custom'
      ? 'flex'
      : 'none';
}


/* =========================================================
   SHOW OR HIDE THERMAL WIDTH CONTROLS
   ========================================================= */

function updatePrintFormatVisibility() {
  const formatSelect =
    document.getElementById('printFormatSelect');

  const thermalSettings =
    document.getElementById('thermalWidthSettings');

  if (!formatSelect || !thermalSettings) {
    return;
  }

  thermalSettings.style.display =
    formatSelect.value === 'thermal'
      ? 'flex'
      : 'none';

  updateThermalWidthVisibility();
}


/* =========================================================
   RENDER SETTINGS PANEL

   Only TUX Admin can edit or save.
   Other logged-in roles can view the shared configuration.
   ========================================================= */

function renderPrintSettings(settings) {
  const normalized =
    normalizeTuxPrintSettings(settings);

  const formatSelect =
    document.getElementById('printFormatSelect');

  const presetSelect =
    document.getElementById('thermalWidthPreset');

  const customWidthInput =
    document.getElementById('customThermalWidth');

  const saveButton =
    document.getElementById('savePrintSettingsBtn');

  if (
    !formatSelect ||
    !presetSelect ||
    !customWidthInput ||
    !saveButton
  ) {
    return;
  }

  const canManage =
    typeof isTuxAdmin === 'function' &&
    isTuxAdmin() === true;

  formatSelect.value =
    normalized.print_format;

  const standardWidths = [58, 72, 80];

  if (
    standardWidths.includes(
      Number(normalized.thermal_width_mm)
    )
  ) {
    presetSelect.value =
      String(normalized.thermal_width_mm);
  } else {
    presetSelect.value = 'custom';
  }

  customWidthInput.value =
    String(normalized.thermal_width_mm);

  formatSelect.disabled = !canManage;
  presetSelect.disabled = !canManage;
  customWidthInput.disabled = !canManage;

  saveButton.style.display =
    canManage
      ? 'inline-block'
      : 'none';

  updatePrintFormatVisibility();

  if (canManage) {
    setPrintSettingsStatus(
      'Shared settings loaded. Changes will apply to all computers.',
      '#2ecc71'
    );
  } else {
    setPrintSettingsStatus(
      'Viewing shared settings. Only TUX Admin can change them.',
      '#9ca3af'
    );
  }
}


/* =========================================================
   LOAD SETTINGS FOR THE SETTINGS VIEW
   ========================================================= */

async function loadPrintSettings() {
  try {
    setPrintSettingsStatus(
      'Loading shared print settings...',
      '#9ca3af'
    );

    const settings =
      await getTuxPrintSettings();

    renderPrintSettings(settings);

    return settings;

  } catch (error) {
    console.error(
      'TUX POS — Print settings load failed:',
      error
    );

    setPrintSettingsStatus(
      error.message ||
        'Could not load shared print settings.',
      '#e74c3c'
    );

    return null;
  }
}


/* =========================================================
   GET SELECTED THERMAL WIDTH
   ========================================================= */

function getSelectedThermalWidth() {
  const presetSelect =
    document.getElementById('thermalWidthPreset');

  const customWidthInput =
    document.getElementById('customThermalWidth');

  if (!presetSelect) {
    throw new Error(
      'The thermal width selector was not found.'
    );
  }

  let width;

  if (presetSelect.value === 'custom') {
    width = Number(
      customWidthInput
        ? customWidthInput.value
        : NaN
    );
  } else {
    width = Number(presetSelect.value);
  }

  if (
    !Number.isFinite(width) ||
    width < 20 ||
    width > 300
  ) {
    throw new Error(
      'Thermal width must be between 20 mm and 300 mm.'
    );
  }

  return width;
}


/* =========================================================
   VERIFY AUTHENTICATED TUX ADMIN IDENTITY

   Do not trust tuxAdminActive alone.
   Verify the current Supabase Auth session and role.
   ========================================================= */

async function verifyAuthenticatedTuxAdmin() {
  if (
    typeof isTuxAdmin !== 'function' ||
    isTuxAdmin() !== true
  ) {
    throw new Error(
      'Only TUX Admin can change shared print settings.'
    );
  }

  const client =
    requirePrintSettingsClient('admin');

  const {
    data: sessionData,
    error: sessionError
  } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const user =
    sessionData?.session?.user;

  if (!user?.id) {
    throw new Error(
      'A valid authenticated TUX Admin session is required. ' +
      'Please log in to TUX Admin again.'
    );
  }

  const {
    data: roleData,
    error: roleError
  } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleError) {
    throw roleError;
  }

  if (
    !roleData ||
    String(roleData.role).toLowerCase() !== 'tuxadmin'
  ) {
    throw new Error(
      'The authenticated Supabase user is not authorized as TUX Admin.'
    );
  }

  return {
    client,
    userId: user.id
  };
}


/* =========================================================
   SAVE SHARED SETTINGS

   The database RLS policy is the security boundary.
   ========================================================= */

async function savePrintSettings() {
  const saveButton =
    document.getElementById('savePrintSettingsBtn');

  if (
    typeof isTuxAdmin !== 'function' ||
    isTuxAdmin() !== true
  ) {
    setPrintSettingsStatus(
      'Only TUX Admin can change shared print settings.',
      '#e74c3c'
    );

    alert(
      'Only TUX Admin can change shared print settings.'
    );

    return false;
  }

  let printFormat;
  let thermalWidth;

  try {
    const formatSelect =
      document.getElementById('printFormatSelect');

    if (!formatSelect) {
      throw new Error(
        'The paper format selector was not found.'
      );
    }

    printFormat =
      String(formatSelect.value || '').toLowerCase();

    if (!['thermal', 'a4'].includes(printFormat)) {
      throw new Error(
        'Please select Thermal Receipt or A4.'
      );
    }

    thermalWidth =
      getSelectedThermalWidth();

  } catch (error) {
    setPrintSettingsStatus(
      error.message,
      '#e74c3c'
    );

    alert(error.message);

    return false;
  }

  const originalButtonText =
    saveButton
      ? saveButton.textContent
      : '';

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
  }

  setPrintSettingsStatus(
    'Verifying TUX Admin and saving settings...',
    '#f1c40f'
  );

  try {
    const {
      client
    } = await verifyAuthenticatedTuxAdmin();

    const payload = {
      print_format: printFormat,
      thermal_width_mm: thermalWidth,
      updated_at: new Date().toISOString()
    };

    const {
      data,
      error
    } = await client
      .from('tux_print_settings')
      .update(payload)
      .eq('id', 1)
      .select(
        'id, print_format, thermal_width_mm, updated_at'
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        'No settings row was updated. Check the TUX Admin RLS policy.'
      );
    }

    tuxPrintSettingsCache =
      normalizeTuxPrintSettings(data);

    renderPrintSettings(tuxPrintSettingsCache);

    setPrintSettingsStatus(
      'Saved successfully. All computers will use the updated settings.',
      '#2ecc71'
    );

    alert(
      'Shared print settings saved successfully.'
    );

    return true;

  } catch (error) {
    console.error(
      'TUX POS — Could not save shared print settings:',
      error
    );

    setPrintSettingsStatus(
      error.message ||
        'Could not save shared print settings.',
      '#e74c3c'
    );

    alert(
      'Could not save print settings.\n\n' +
      String(
        error.message ||
        'Please check your Supabase connection and policies.'
      )
    );

    return false;

  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent =
        originalButtonText || 'Save Print Settings';
    }

    if (
      typeof loadPrintSettings === 'function'
    ) {
      await loadPrintSettings();
    }
  }
}


/* =========================================================
   INITIALIZE SETTINGS PANEL EVENTS
   Call after html/settings.html has been injected.
   ========================================================= */

function initializePrintSettingsUI() {
  const formatSelect =
    document.getElementById('printFormatSelect');

  const presetSelect =
    document.getElementById('thermalWidthPreset');

  if (formatSelect) {
    formatSelect.onchange =
      updatePrintFormatVisibility;
  }

  if (presetSelect) {
    presetSelect.onchange =
      updateThermalWidthVisibility;
  }

  updatePrintFormatVisibility();
}


/* =========================================================
   GLOBAL REFERENCES
   Compatible with the existing classic-script structure.
   ========================================================= */

window.getTuxPrintSettings =
  getTuxPrintSettings;

window.loadPrintSettings =
  loadPrintSettings;

window.savePrintSettings =
  savePrintSettings;

window.renderPrintSettings =
  renderPrintSettings;

window.initializePrintSettingsUI =
  initializePrintSettingsUI;
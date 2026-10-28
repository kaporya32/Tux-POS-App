/* =========================================================
   TUX POS — WORKERS / ATTENDANCE SERVICE
   Supabase data access
   ========================================================= */


/* =========================================================
   WORKERS REALTIME
   ========================================================= */

let workersRealtimeChannel = null;


/* =========================================================
   ATTENDANCE REALTIME
   ========================================================= */

let attendanceRealtimeChannel = null;
let attendanceRealtimeRefreshTimer = null;


/* =========================================================
   PERMISSION HELPERS
   ========================================================= */

/*
 * Worker management is Tux Admin only.
 *
 * Normal workers still need access to:
 * - createAttendanceSession()
 * - closeAttendanceSession()
 * - loadWorkerAttendance()
 *
 * Admin can view workers/attendance, but cannot modify them.
 */

function requireTuxAdminForWorkerManagement() {

  if (
    typeof tuxAdminActive !== 'undefined' &&
    tuxAdminActive === true
  ) {

    return true;

  }


  alert(
    'Only Tux Admin can modify workers.'
  );


  return false;

}


/*
 * Operations that modify attendance for the normal
 * logged-in worker are allowed.
 *
 * Admin Spectate cannot create/close attendance.
 *
 * Tux Admin is always allowed.
 */


function requireAttendanceWritePermission(options = {}) {

  /*
   * Allow attendance closure during logout only.
   * This does not grant Admin permission to make
   * ordinary attendance changes.
   */

  if (
    options.allowLogout === true
  ) {

    return true;

  }


  /*
   * Admin remains in Spectate Mode.
   * TUX Admin retains the existing permission.
   */

  if (
    typeof adminActive !== 'undefined' &&
    adminActive === true &&
    !(
      typeof tuxAdminActive !== 'undefined' &&
      tuxAdminActive === true
    )
  ) {

    alert(
      'Admin is in Spectate Mode.\n\n' +
      'Attendance cannot be changed.'
    );

    return false;

  }


  return true;

}




/* =========================================================
   TUX POS — ADMIN'S OWN ATTENDANCE
   Separate from worker attendance permissions.
   ========================================================= */


async function createAdminAttendanceSession(adminId) {

  /* =======================================================
     VALIDATE ADMIN ID
     Do not require adminActive to be true here.
     staffLogin() starts attendance BEFORE activating Admin.
     TUX Admin and Admin must be allowed to work simultaneously.
     ======================================================= */

  if (!adminId) {
    alert(
      'Admin attendance could not start: Admin ID is missing.'
    );

    return false;
  }

  try {

    /* =====================================================
       CHECK FOR AN EXISTING OPEN ATTENDANCE SESSION
       ===================================================== */

    const {
      data: existing,
      error: findError
    } = await supabaseClient
      .from('attendance')
      .select('id')
      .eq('worker_id', adminId)
      .eq('status', 'working')
      .is('check_out', null)
      .limit(1);

    if (findError) {
      throw findError;
    }


    /* =====================================================
       REUSE EXISTING OPEN SESSION
       ===================================================== */

    if (existing && existing.length > 0) {

      if (typeof loadAllAttendance === 'function') {
        await loadAllAttendance();
      }

      if (typeof renderWorkersView === 'function') {
        renderWorkersView();
      }

      if (typeof renderTodayWorkers === 'function') {
        renderTodayWorkers();
      }

      window.dispatchEvent(
        new CustomEvent('tux-attendance-updated')
      );

      console.log(
        'TUX POS — Existing Admin attendance session found:',
        adminId
      );

      return true;
    }


    /* =====================================================
       CREATE ADMIN ATTENDANCE RECORD
       ===================================================== */

    const {
      data,
      error
    } = await supabaseClient
      .from('attendance')
      .insert({
        worker_id: adminId,
        date: getTodayKey(),
        check_in: new Date().toISOString(),
        status: 'working'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        'Supabase did not return the Admin attendance record.'
      );
    }


    /* =====================================================
       REFRESH ATTENDANCE DATA AND UI
       ===================================================== */

    if (typeof loadAllAttendance === 'function') {
      await loadAllAttendance();
    }

    if (typeof renderWorkersView === 'function') {
      renderWorkersView();
    }

    if (typeof renderSelectedWorker === 'function') {
      renderSelectedWorker();
    }

    if (typeof renderTodayWorkers === 'function') {
      renderTodayWorkers();
    }

    window.dispatchEvent(
      new CustomEvent('tux-attendance-updated')
    );


    /* =====================================================
       SUCCESS
       ===================================================== */

    console.log(
      'TUX POS — Admin attendance check-in successful:',
      data
    );

    return true;

  } catch (error) {

    console.error(
      'Admin attendance check-in failed:',
      error
    );

    alert(
      'Admin check-in failed. Please check the connection and try again.'
    );

    return false;
  }
}





async function endAdminAttendanceSession(adminId) {
  console.log('TUX POS — Starting Admin attendance checkout.', {
    adminId,
    adminActive:
      typeof adminActive !== 'undefined' ? adminActive : 'undefined',
    tuxAdminActive:
      typeof tuxAdminActive !== 'undefined' ? tuxAdminActive : 'undefined'
  });

  if (
    typeof adminActive === 'undefined' ||
    adminActive !== true ||
    (
      typeof tuxAdminActive !== 'undefined' &&
      tuxAdminActive === true
    )
  ) {
    console.warn(
      'TUX POS — Admin attendance checkout skipped by role guard.'
    );

    return true;
  }

  if (!adminId) {
    console.error('TUX POS — Admin ID is missing during checkout.');
    alert('Admin attendance could not close: Admin ID is missing.');
    return false;
  }

  try {
    const {
      data: session,
      error: findError
    } = await supabaseClient
      .from('attendance')
      .select('id, worker_id, check_in, check_out, status')
      .eq('worker_id', adminId)
      .eq('status', 'working')
      .is('check_out', null)
      .order('check_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error(
        'TUX POS — Failed to find Admin attendance:',
        findError
      );

      alert(
        'Could not find Admin attendance.\n\n' +
        (findError.message || JSON.stringify(findError))
      );

      return false;
    }

    if (!session) {
      console.warn(
        'TUX POS — No open Admin attendance record found.',
        { adminId }
      );

      alert(
        'No open Admin attendance record was found.\n\n' +
        'Admin ID: ' + adminId + '\n\n' +
        'The Admin will remain logged in so attendance is not silently skipped.'
      );

      return false;
    }

    const checkOut = new Date();
    const checkIn = new Date(session.check_in);

    const hours = Math.max(
      0,
      (checkOut.getTime() - checkIn.getTime()) / 3600000
    );

    const {
      data: updatedSession,
      error: updateError
    } = await supabaseClient
      .from('attendance')
      .update({
        check_out: checkOut.toISOString(),
        hours: Number(hours.toFixed(2)),
        status: 'completed'
      })
      .eq('id', session.id)
      .eq('worker_id', adminId)
      .is('check_out', null)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error(
        'TUX POS — Failed to update Admin attendance:',
        updateError
      );

      alert(
        'Could not close Admin attendance.\n\n' +
        (updateError.message || JSON.stringify(updateError))
      );

      return false;
    }

    if (!updatedSession) {
      console.error(
        'TUX POS — Attendance update returned no record.',
        { sessionId: session.id, adminId }
      );

      alert(
        'The attendance record was found, but Supabase did not confirm the update.\n\n' +
        'Attendance ID: ' + session.id
      );

      return false;
    }

    console.log(
      'TUX POS — Admin attendance checkout successful:',
      updatedSession
    );

    if (typeof loadAllAttendance === 'function') {
      await loadAllAttendance();
    }

    if (typeof renderWorkersView === 'function') {
      renderWorkersView();
    }

    if (typeof renderSelectedWorker === 'function') {
      renderSelectedWorker();
    }

    if (typeof renderTodayWorkers === 'function') {
      renderTodayWorkers();
    }

    window.dispatchEvent(
      new CustomEvent('tux-attendance-updated')
    );

    return true;

  } catch (error) {
    console.error(
      'TUX POS — Unexpected Admin attendance checkout error:',
      error
    );

    alert(
      'Unexpected Admin attendance checkout error.\n\n' +
      (error.message || String(error))
    );

    return false;
  }
}











/* =========================================================
   START WORKERS REALTIME
   ========================================================= */


function startWorkersRealtime() {

  // Avoid creating duplicate subscriptions.
  if (workersRealtimeChannel) {

    console.log(
      'TUX POS — Workers realtime already started.'
    );

    return;

  }


  console.log(
    'TUX POS — Subscribing to workers realtime...'
  );


  workersRealtimeChannel =
    supabaseClient

      .channel('tux-workers-realtime')

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workers'
        },

        async function (payload) {

          console.log(
            'TUX POS — Workers realtime event:',
            payload.eventType,
            payload
          );


          try {

            await loadWorkersFromSupabase();


            window.dispatchEvent(
              new CustomEvent(
                'tux-workers-updated',
                {
                  detail: payload
                }
              )
            );

          } catch (error) {

            console.error(
              'TUX POS — Failed to refresh workers after realtime event:',
              error
            );

          }

        }
      )

      .subscribe(function (status) {

        console.log(
          'TUX POS — Workers realtime status:',
          status
        );

      });

}

/* =========================================================
   STOP WORKERS REALTIME
   ========================================================= */

function stopWorkersRealtime() {

  if (!workersRealtimeChannel) {

    return;

  }


  supabaseClient.removeChannel(
    workersRealtimeChannel
  );


  workersRealtimeChannel = null;


  console.log(
    'TUX POS — Workers realtime stopped.'
  );

}


/* =========================================================
   START ATTENDANCE REALTIME
   ========================================================= */

function startAttendanceRealtime() {

  if (attendanceRealtimeChannel) {

    supabaseClient.removeChannel(
      attendanceRealtimeChannel
    );

    attendanceRealtimeChannel = null;

  }


  attendanceRealtimeChannel =
    supabaseClient

      .channel('tux-attendance-realtime')

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },

        function (payload) {

          console.log(
            'TUX POS — Attendance realtime event:',
            payload.eventType,
            payload
          );


          scheduleAttendanceRealtimeRefresh();

        }
      )

      .subscribe(function (status) {

        console.log(
          'TUX POS — Attendance realtime status:',
          status
        );

      });

}


/* =========================================================
   SYNC ACTIVE STAFF FROM ATTENDANCE
   ========================================================= */

function syncActiveStaffIdsFromAttendance() {

  const openWorkerIds = [];


  workersList.forEach(
    function (worker) {

      if (
        !Array.isArray(
          worker.attendance
        )
      ) {

        return;

      }


      const hasOpenSession =
        worker.attendance.some(
          function (record) {

            return (
              record &&
              record.checkIn &&
              !record.checkOut &&
              record.status === 'working'
            );

          }
        );


      if (hasOpenSession) {

        openWorkerIds.push(
          String(worker.id)
        );

      }

    }
  );


  activeStaffIds =
    openWorkerIds;


  console.log(
    'TUX POS — Active staff synchronized from attendance:',
    activeStaffIds
  );

}


/* =========================================================
   SCHEDULE ATTENDANCE REALTIME REFRESH
   ========================================================= */


function scheduleAttendanceRealtimeRefresh() {

  if (attendanceRealtimeRefreshTimer) {

    clearTimeout(
      attendanceRealtimeRefreshTimer
    );

  }


  attendanceRealtimeRefreshTimer =
    setTimeout(
      async function () {

        attendanceRealtimeRefreshTimer = null;


        try {

          await loadAllAttendance();


          /*
           * Refresh attendance displays only.
           * Do not overwrite this device's login session.
           */


          if (
            typeof renderWorkersView ===
            'function'
          ) {

            renderWorkersView();

          }


          if (
            typeof renderSelectedWorker ===
            'function'
          ) {

            renderSelectedWorker();

          }


          if (
            typeof updateStaffUI ===
            'function'
          ) {

            updateStaffUI();

          }


          window.dispatchEvent(
            new CustomEvent(
              'tux-attendance-updated'
            )
          );


          console.log(
            'TUX POS — Attendance refreshed after realtime event.'
          );


        } catch (error) {

          console.error(
            'TUX POS — Failed to refresh attendance after realtime event:',
            error
          );

        }

      },
      300
    );

}

/* =========================================================
   STOP ATTENDANCE REALTIME
   ========================================================= */

function stopAttendanceRealtime() {

  if (attendanceRealtimeRefreshTimer) {

    clearTimeout(
      attendanceRealtimeRefreshTimer
    );

    attendanceRealtimeRefreshTimer = null;

  }


  if (!attendanceRealtimeChannel) {

    return;

  }


  supabaseClient.removeChannel(
    attendanceRealtimeChannel
  );


  attendanceRealtimeChannel = null;


  console.log(
    'TUX POS — Attendance realtime stopped.'
  );

}


/* =========================================================
   WORKERS
   ========================================================= */

async function loadWorkersFromSupabase() {

  const { data, error } =
    await supabaseClient

      .from('workers')

      .select('*')

      .eq(
        'active',
        true
      )

      .order(
        'created_at',
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      'Failed to load workers:',
      error
    );

    throw error;

  }


  /*
   * Preserve attendance currently held in memory.
   */

  const previousAttendanceByWorkerId = {};


  workersList.forEach(
    function (worker) {

      previousAttendanceByWorkerId[
        String(worker.id)
      ] =
        Array.isArray(
          worker.attendance
        )
          ? worker.attendance
          : [];

    }
  );


  workersList =
    (data || []).map(
      function (worker) {

        return {

          id:
            worker.id,

          name:
            worker.name,

          password:
            worker.password,

          role:
            worker.role,

          active:
            worker.active,

          attendance:
            previousAttendanceByWorkerId[
              String(worker.id)
            ] || []

        };

      }
    );


  return workersList;

}


/* =========================================================
   CREATE WORKER
   ========================================================= */

async function createWorkerInSupabase(
  name,
  password,
  role = 'worker'
) {

  if (
    !requireTuxAdminForWorkerManagement()
  ) {

    throw new Error(
      'Only Tux Admin can create workers.'
    );

  }


  const { data, error } =
    await supabaseClient

      .from('workers')

      .insert({

        name:
          name,

        password:
          password,

        role:
          role,

        active:
          true

      })

      .select()
      .single();


  if (error) {

    console.error(
      'Failed to create worker:',
      error
    );

    throw error;

  }


  const worker = {

    id:
      data.id,

    name:
      data.name,

    password:
      data.password,

    role:
      data.role,

    active:
      data.active,

    attendance:
      []

  };


  workersList.push(
    worker
  );


  return worker;

}


/* =========================================================
   UPDATE WORKER PASSWORD
   ========================================================= */

async function updateWorkerPasswordInSupabase(
  workerId,
  newPassword
) {

  if (
    !requireTuxAdminForWorkerManagement()
  ) {

    throw new Error(
      'Only Tux Admin can change worker passwords.'
    );

  }


  const { data, error } =
    await supabaseClient

      .from('workers')

      .update({

        password:
          newPassword

      })

      .eq(
        'id',
        workerId
      )

      .select()
      .single();


  if (error) {

    console.error(
      'Failed to update worker password:',
      error
    );

    throw error;

  }


  const worker =
    getWorkerById(
      workerId
    );


  if (worker) {

    worker.password =
      data.password;

  }


  return data;

}


/* =========================================================
   DELETE / DEACTIVATE WORKER
   ========================================================= */

async function deleteWorkerFromSupabase(workerId) {

  if (!requireTuxAdminForWorkerManagement()) {
    throw new Error(
      'Only Tux Admin can deactivate accounts.'
    );
  }

  if (!workerId) {
    throw new Error('Account ID is required.');
  }

  const account = workersList.find(function (item) {
    return String(item.id) === String(workerId);
  });

  if (!account) {
    throw new Error('Account not found.');
  }

  const { error } = await supabaseClient
    .from('workers')
    .update({
      active: false
    })
    .eq('id', workerId);

  if (error) {
    console.error('Failed to deactivate account:', error);
    throw error;
  }

  // Remove the account from the in-memory list.
  workersList = workersList.filter(function (item) {
    return String(item.id) !== String(workerId);
  });

  // Only Workers participate in worker sessions and attendance.
  if (account.role === 'worker') {
    activeStaffIds = activeStaffIds.filter(function (id) {
      return String(id) !== String(workerId);
    });
  }

}


/* =========================================================
   ATTENDANCE
   ========================================================= */

async function loadWorkerAttendance(
  workerId
) {

  const { data, error } =
    await supabaseClient

      .from('attendance')

      .select('*')

      .eq(
        'worker_id',
        workerId
      )

      .order(
        'check_in',
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      'Failed to load worker attendance:',
      error
    );

    throw error;

  }


  const worker =
    getWorkerById(
      workerId
    );


  if (worker) {

    worker.attendance =
      (data || []).map(
        function (record) {

          return {

            id:
              record.id,

            sessionId:
              record.id,

            date:
              record.date,

            checkIn:
              record.check_in,

            checkOut:
              record.check_out || '',

            hours:
              Number(
                record.hours || 0
              ),

            status:
              record.status === 'working'
                ? 'working'
                : 'completed'

          };

        }
      );

  }


  return data || [];

}


/* =========================================================
   LOAD ALL ATTENDANCE
   ========================================================= */

async function loadAllAttendance() {

  const { data, error } =
    await supabaseClient

      .from('attendance')

      .select('*')

      .order(
        'check_in',
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      'Failed to load attendance:',
      error
    );

    throw error;

  }


  workersList.forEach(
    function (worker) {

      worker.attendance = [];

    }
  );


  (data || []).forEach(
    function (record) {

      const worker =
        getWorkerById(
          record.worker_id
        );


      if (!worker) {

        return;

      }


      worker.attendance.push({

        id:
          record.id,

        sessionId:
          record.id,

        date:
          record.date,

        checkIn:
          record.check_in,

        checkOut:
          record.check_out || '',

        hours:
          Number(
            record.hours || 0
          ),

        status:
          record.status === 'working'
            ? 'working'
            : 'completed'

      });

    }
  );


  return data || [];

}


/* =========================================================
   CREATE ATTENDANCE SESSION
   ========================================================= */


async function createAttendanceSession(
  workerId,
  options = {}
) {

  /* =======================================================
     VALIDATE WORKER ID
     ======================================================= */

  if (!workerId) {

    throw new Error(
      'Worker ID is required.'
    );

  }



/* =======================================================
   PERMISSION CHECK
   ======================================================= */

const isWorkerLogin =
  options.allowWorkerLogin === true;


console.log(
  'TUX POS — Attendance permission diagnostic:',
  {
    workerId: workerId,
    isWorkerLogin: isWorkerLogin,
    adminActive:
      typeof adminActive !== 'undefined'
        ? adminActive
        : 'undefined',
    tuxAdminActive:
      typeof tuxAdminActive !== 'undefined'
        ? tuxAdminActive
        : 'undefined'
  }
);


if (
  !isWorkerLogin &&
  typeof requireAttendanceWritePermission === 'function' &&
  !requireAttendanceWritePermission()
) {

  throw new Error(
    'You do not have permission to create attendance sessions.'
  );

}



  /* =======================================================
     PREPARE CHECK-IN DATA
     ======================================================= */

  const now =
    new Date();


  /* =======================================================
     CREATE ATTENDANCE SESSION IN SUPABASE
     ======================================================= */

  const {
    data,
    error
  } = await supabaseClient
    .from('attendance')
    .insert({

      worker_id:
        workerId,

      date:
        getTodayKey(),

      check_in:
        now.toISOString(),

      status:
        'working'

    })
    .select()
    .single();


  if (error) {

    console.error(
      'Failed to create attendance session:',
      error
    );

    throw error;

  }


  if (!data) {

    throw new Error(
      'Supabase did not return the created attendance session.'
    );

  }


  /* =======================================================
     UPDATE LOCAL WORKER ATTENDANCE
     ======================================================= */

  const worker =
    typeof getWorkerById === 'function'
      ? getWorkerById(workerId)
      : null;


  if (worker) {

    if (!Array.isArray(worker.attendance)) {

      worker.attendance = [];

    }


    const alreadyExists =
      worker.attendance.some(
        function (record) {

          return (
            String(record.id) ===
            String(data.id)
          );

        }
      );


    if (!alreadyExists) {

      worker.attendance.unshift({

        id:
          data.id,

        sessionId:
          data.id,

        date:
          data.date,

        checkIn:
          data.check_in,

        checkOut:
          '',

        hours:
          0,

        status:
          'working'

      });

    }

  }


  /* =======================================================
     SYNCHRONIZE ACTIVE STAFF
     ======================================================= */

  if (Array.isArray(activeStaffIds)) {

    const alreadyActive =
      activeStaffIds.some(
        function (id) {

          return (
            String(id) ===
            String(workerId)
          );

        }
      );


    if (!alreadyActive) {

      activeStaffIds.push(
        String(workerId)
      );

    }

  }


  /* =======================================================
     LOG SUCCESS
     ======================================================= */

  console.log(
    'TUX POS — Attendance session created:',
    data
  );


  return data;

}




/* =========================================================
   CLOSE ATTENDANCE SESSION
   ========================================================= */



async function closeAttendanceSession(
  attendanceId,
  hours,
  options = {}
) {

  /* =======================================================
     VALIDATE ATTENDANCE ID
     ======================================================= */

  if (!attendanceId) {

    throw new Error(
      'Attendance ID is required.'
    );

  }


  /* =======================================================
     PERMISSION CHECK
     ======================================================= */

  const isLogout =
    options.allowLogout === true;


  if (
    typeof requireAttendanceWritePermission === 'function' &&
    !requireAttendanceWritePermission({
      allowLogout: isLogout
    })
  ) {

    throw new Error(
      'You do not have permission to close this attendance session.'
    );

  }


  /* =======================================================
     PREPARE CHECK-OUT DATA
     ======================================================= */

  const checkOut =
    new Date().toISOString();

  const finalHours =
    Number(hours || 0);


  console.log(
    'TUX POS — Closing attendance session:',
    {
      attendanceId: attendanceId,
      hours: finalHours,
      checkOut: checkOut,
      logout: isLogout
    }
  );


  /* =======================================================
     UPDATE SUPABASE
     ======================================================= */

  const {
    data,
    error
  } = await supabaseClient
    .from('attendance')
    .update({
      check_out: checkOut,
      hours: finalHours,
      status: 'completed'
    })
    .eq('id', attendanceId)
    .select('*')
    .single();


  if (error) {

    console.error(
      'TUX POS — Failed to close attendance session:',
      error
    );

    throw error;

  }


  if (!data) {

    throw new Error(
      'Supabase did not return the updated attendance record.'
    );

  }


  console.log(
    'TUX POS — Attendance session closed successfully:',
    data
  );


  /* =======================================================
     UPDATE LOCAL WORKER ATTENDANCE RECORDS
     ======================================================= */

  if (Array.isArray(workersList)) {

    workersList.forEach(
      function (worker) {

        if (
          !worker ||
          !Array.isArray(worker.attendance)
        ) {

          return;

        }


        worker.attendance.forEach(
          function (record) {

            if (
              String(record.id) !==
              String(attendanceId)
            ) {

              return;

            }


            record.checkOut =
              data.check_out || '';


            record.hours =
              Number(data.hours || 0);


            record.status =
              data.status === 'completed'
                ? 'completed'
                : data.status;

          }
        );

      }
    );

  }


  /* =======================================================
     FIND WORKER ASSOCIATED WITH THIS SESSION
     ======================================================= */

  const closedWorker =
    Array.isArray(workersList)
      ? workersList.find(
          function (worker) {

            return (
              worker &&
              Array.isArray(worker.attendance) &&
              worker.attendance.some(
                function (record) {

                  return (
                    String(record.id) ===
                    String(attendanceId)
                  );

                }
              )
            );

          }
        )
      : null;


  /* =======================================================
     REMOVE WORKER FROM ACTIVE LIST WHEN FULLY CHECKED OUT
     ======================================================= */

  if (closedWorker) {

    const stillWorking =
      Array.isArray(closedWorker.attendance) &&
      closedWorker.attendance.some(
        function (record) {

          return (
            record.status === 'working' &&
            record.checkIn &&
            !record.checkOut
          );

        }
      );


    if (
      !stillWorking &&
      Array.isArray(activeStaffIds)
    ) {

      activeStaffIds =
        activeStaffIds.filter(
          function (id) {

            return (
              String(id) !==
              String(closedWorker.id)
            );

          }
        );

    }

  }


  /* =======================================================
     RETURN UPDATED ATTENDANCE RECORD
     ======================================================= */

  return data;

}





async function endAttendanceSession(workerId) {

  /* =======================================================
     FIND WORKER
     ======================================================= */

  const worker =
    Array.isArray(workersList)
      ? workersList.find(
          item =>
            String(item.id) === String(workerId)
        )
      : null;


  if (!worker) {

    throw new Error(
      'Worker not found.'
    );

  }


  /* =======================================================
     FIND ACTIVE ATTENDANCE SESSION
     ======================================================= */

  const attendance =
    Array.isArray(worker.attendance)
      ? worker.attendance
      : [];


  const activeRecord =
    attendance
      .filter(
        record =>
          record.checkIn &&
          !record.checkOut &&
          record.status === 'working'
      )
      .sort(
        (a, b) =>
          new Date(b.checkIn).getTime() -
          new Date(a.checkIn).getTime()
      )[0];


  if (!activeRecord) {

    throw new Error(
      'No active attendance session found for this worker.'
    );

  }


  /* =======================================================
     CALCULATE CHECK-OUT HOURS
     ======================================================= */

  const checkOut =
    new Date().toISOString();


  const hours =
    Math.max(
      0,
      Number(
        calculateWorkedHours(
          activeRecord.checkIn,
          checkOut
        )
      ) || 0
    );


  /* =======================================================
     CLOSE ATTENDANCE SESSION DURING LOGOUT
     ======================================================= */

  return await closeAttendanceSession(
    activeRecord.id,
    hours,
    {
      allowLogout: true
    }
  );

}



/* =========================================================
   CLOSE ALL OPEN SESSIONS
   ========================================================= */

async function closeAllAttendanceSessions() {

  if (
    !requireTuxAdminForWorkerManagement()
  ) {

    throw new Error(
      'Only Tux Admin can close all attendance sessions.'
    );

  }


  const workingRecords = [];


  workersList.forEach(
    function (worker) {

      if (!worker.attendance) {

        return;

      }


      worker.attendance.forEach(
        function (record) {

          if (
            record.status === 'working'
          ) {

            workingRecords.push({

              worker:
                worker,

              record:
                record

            });

          }

        }
      );

    }
  );


  /*
   * Tux Admin has already passed the permission check.
   * closeAttendanceSession() also allows Tux Admin.
   */

  for (
    const item of workingRecords
  ) {

    const checkIn =
      new Date(
        item.record.checkIn
      );


    const now =
      new Date();


    const hours =
      Math.max(
        0,
        (
          now.getTime() -
          checkIn.getTime()
        ) / 3600000
      );


    await closeAttendanceSession(

      item.record.id,

      Math.round(
        hours * 100
      ) / 100

    );

  }

}


/* =========================================================
   COMPATIBILITY
   ========================================================= */

function saveWorkersToStorage() {

  return true;

}


function migrateWorkerData() {

  return true;

}


/* =========================================================
   HELPERS
   ========================================================= */

function getWorkerById(
  id
) {

  return workersList.find(
    function (worker) {

      return (
        String(worker.id) ===
        String(id)
      );

    }
  ) || null;

}


function getActiveWorkers() {

  return activeStaffIds

    .map(
      function (id) {

        return getWorkerById(
          id
        );

      }
    )

    .filter(
      function (worker) {

        return worker;

      }

    );

}


function isStaffLoggedIn(
  workerId
) {

  return activeStaffIds.some(
    function (id) {

      return (
        String(id) ===
        String(workerId)
      );

    }
  );

}


function getCurrentStaff() {

  const active =
    getActiveWorkers();


  return active.length
    ? active[0]
    : null;

}


/* =========================================================
   WORKER CRUD BRIDGE
   ========================================================= */

async function addWorkerToSupabase(
  name,
  password,
  role = 'worker'
) {

  if (!requireTuxAdminForWorkerManagement()) {
    throw new Error(
      'Only Tux Admin can manage accounts.'
    );
  }

  name = String(name || '').trim();
  password = String(password || '').trim();

  if (!name || !password) {
    throw new Error(
      'Account name and password are required.'
    );
  }

  if (!['worker', 'admin'].includes(role)) {
    throw new Error(
      'Invalid account role.'
    );
  }

  const existing = workersList.find(function (account) {
    return (
      account.active !== false &&
      String(account.name).trim().toLowerCase() ===
        name.toLowerCase()
    );
  });

  if (existing) {
    throw new Error(
      'An account with this name already exists.'
    );
  }

  return await createWorkerInSupabase(
    name,
    password,
    role
  );

}
/* =========================================================
   CHANGE WORKER PASSWORD
   ========================================================= */

async function changeWorkerPasswordInSupabase(
  workerId,
  newPassword
) {

  if (
    !requireTuxAdminForWorkerManagement()
  ) {

    throw new Error(
      'Only Tux Admin can change worker passwords.'
    );

  }


  newPassword =
    String(
      newPassword || ''
    ).trim();


  if (!newPassword) {

    throw new Error(
      'Password cannot be empty.'
    );

  }


  return await updateWorkerPasswordInSupabase(

    workerId,

    newPassword

  );

}


/* =========================================================
   REMOVE WORKER
   ========================================================= */

async function removeWorkerFromSupabase(
  workerId
) {

  if (
    !requireTuxAdminForWorkerManagement()
  ) {

    throw new Error(
      'Only Tux Admin can remove workers.'
    );

  }


  if (!workerId) {

    throw new Error(
      'Worker ID is required.'
    );

  }


  await deleteWorkerFromSupabase(
    workerId
  );


  return true;

}
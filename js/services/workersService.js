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

function requireAttendanceWritePermission() {

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

async function deleteWorkerFromSupabase(
  workerId
) {

  if (
    !requireTuxAdminForWorkerManagement()
  ) {

    throw new Error(
      'Only Tux Admin can deactivate workers.'
    );

  }


  const { error } =
    await supabaseClient

      .from('workers')

      .update({

        active:
          false

      })

      .eq(
        'id',
        workerId
      );


  if (error) {

    console.error(
      'Failed to deactivate worker:',
      error
    );

    throw error;

  }


  workersList =
    workersList.filter(
      function (worker) {

        return (
          String(worker.id) !==
          String(workerId)
        );

      }
    );


  activeStaffIds =
    activeStaffIds.filter(
      function (id) {

        return (
          String(id) !==
          String(workerId)
        );

      }
    );

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
  workerId
) {

  if (
    !requireAttendanceWritePermission()
  ) {

    throw new Error(
      'Admin cannot create attendance sessions.'
    );

  }


  const now =
    new Date();


  const { data, error } =
    await supabaseClient

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


  const worker =
    getWorkerById(
      workerId
    );


  if (worker) {

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


  /*
   * Keep local browser state synchronized immediately.
   */

  if (
    !activeStaffIds.some(
      function (id) {

        return (
          String(id) ===
          String(workerId)
        );

      }
    )
  ) {

    activeStaffIds.push(
      String(workerId)
    );

  }


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
  hours
) {

  if (
    !requireAttendanceWritePermission()
  ) {

    throw new Error(
      'Admin cannot close attendance sessions.'
    );

  }


  if (!attendanceId) {

    throw new Error(
      'Attendance ID is required.'
    );

  }


  const checkOut =
    new Date().toISOString();


  const finalHours =
    Number(
      hours || 0
    );


  console.log(
    'TUX POS — Closing attendance session:',
    {
      attendanceId:
        attendanceId,

      hours:
        finalHours,

      checkOut:
        checkOut
    }
  );


  const { data, error } =
    await supabaseClient

      .from('attendance')

      .update({

        check_out:
          checkOut,

        hours:
          finalHours,

        status:
          'completed'

      })

      .eq(
        'id',
        attendanceId
      )

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


  workersList.forEach(
    function (worker) {

      if (!worker.attendance) {

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
            Number(
              data.hours || 0
            );


          record.status =
            data.status === 'completed'
              ? 'completed'
              : data.status;

        }
      );

    }
  );


  /*
   * Find the worker associated with the closed session.
   */

  const closedWorker =
    workersList.find(
      function (worker) {

        return (
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
    );


  if (closedWorker) {

    const stillWorking =
      Array.isArray(
        closedWorker.attendance
      ) &&
      closedWorker.attendance.some(
        function (record) {

          return (
            record.status === 'working' &&
            record.checkIn &&
            !record.checkOut
          );

        }
      );


    if (!stillWorking) {

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


  return data;

}

async function endAttendanceSession(workerId) {

  const worker = Array.isArray(workersList)
    ? workersList.find(
        item => String(item.id) === String(workerId)
      )
    : null;

  if (!worker) {
    throw new Error('Worker not found.');
  }

  const attendance = Array.isArray(worker.attendance)
    ? worker.attendance
    : [];

  const activeRecord = attendance
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

  const checkOut = new Date().toISOString();

  const hours = Math.max(
    0,
    Number(
      calculateWorkedHours(
        activeRecord.checkIn,
        checkOut
      )
    ) || 0
  );

  return await closeAttendanceSession(
    activeRecord.id,
    hours
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

  if (
    !requireTuxAdminForWorkerManagement()
  ) {

    throw new Error(
      'Only Tux Admin can add workers.'
    );

  }


  name =
    String(
      name || ''
    ).trim();


  password =
    String(
      password || ''
    ).trim();


  if (
    !name ||
    !password
  ) {

    throw new Error(
      'Worker name and password are required.'
    );

  }


  const existing =
    workersList.find(
      function (worker) {

        return (
          worker.name.toLowerCase() ===
          name.toLowerCase()
        );

      }
    );


  if (existing) {

    throw new Error(
      'A worker with this name already exists.'
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
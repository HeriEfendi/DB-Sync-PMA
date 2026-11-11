use std::sync::atomic::{AtomicBool, Ordering};

pub static USER_CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);
pub static WORKER_ABORT_REQUESTED: AtomicBool = AtomicBool::new(false);
pub static ACTIVE_CHILD_PIDS: std::sync::Mutex<Vec<u32>> = std::sync::Mutex::new(Vec::new());

static CANCEL_NOTIFIER: std::sync::OnceLock<(
    tokio::sync::watch::Sender<bool>,
    tokio::sync::watch::Receiver<bool>,
)> = std::sync::OnceLock::new();

pub fn get_cancel_watch() -> &'static (tokio::sync::watch::Sender<bool>, tokio::sync::watch::Receiver<bool>) {
    CANCEL_NOTIFIER.get_or_init(|| tokio::sync::watch::channel(false))
}

pub fn register_child_pid(pid: u32) {
    if let Ok(mut lock) = ACTIVE_CHILD_PIDS.lock() {
        if !lock.contains(&pid) {
            lock.push(pid);
        }
    }
}

pub fn unregister_child_pid(pid: u32) {
    if let Ok(mut lock) = ACTIVE_CHILD_PIDS.lock() {
        lock.retain(|&p| p != pid);
    }
}

pub fn kill_all_child_processes() {
    let pids = {
        if let Ok(mut lock) = ACTIVE_CHILD_PIDS.lock() {
            let pids = lock.clone();
            lock.clear();
            pids
        } else {
            Vec::new()
        }
    };
    for pid in pids {
        #[cfg(unix)]
        {
            let _ = std::process::Command::new("kill").args(["-9", &pid.to_string()]).output();
        }
        #[cfg(windows)]
        {
            let _ = crate::process_utils::new_std_command("taskkill").args(["/F", "/T", "/PID", &pid.to_string()]).output();
        }
    }
}

pub fn reset_cancel_state() {
    USER_CANCEL_REQUESTED.store(false, Ordering::SeqCst);
    WORKER_ABORT_REQUESTED.store(false, Ordering::SeqCst);
    let (tx, _) = get_cancel_watch();
    let _ = tx.send(false);
}

pub fn request_cancel() {
    USER_CANCEL_REQUESTED.store(true, Ordering::SeqCst);
    WORKER_ABORT_REQUESTED.store(true, Ordering::SeqCst);
    let (tx, _) = get_cancel_watch();
    let _ = tx.send(true);
    kill_all_child_processes();
}

pub fn is_user_cancelled() -> bool {
    USER_CANCEL_REQUESTED.load(Ordering::SeqCst)
}

pub fn is_aborted() -> bool {
    USER_CANCEL_REQUESTED.load(Ordering::SeqCst) || WORKER_ABORT_REQUESTED.load(Ordering::SeqCst)
}


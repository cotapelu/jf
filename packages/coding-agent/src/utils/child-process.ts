import type { ChildProcess } from "node:child_process";

const EXIT_STDIO_GRACE_MS = 100;

class ChildProcessWaiter {
	private settled = false;
	private exited = false;
	private exitCode: number | null = null;
	private postExitTimer?: NodeJS.Timeout;
	private stdoutEnded: boolean;
	private stderrEnded: boolean;
	private child: ChildProcess;
	private resolve!: (value: number | null) => void;
	private reject!: (reason?: any) => void;

	constructor(child: ChildProcess) {
		this.child = child;
		this.stdoutEnded = child.stdout === null;
		this.stderrEnded = child.stderr === null;
	}

	wait(): Promise<number | null> {
		return new Promise<number | null>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			this.setupListeners();
		});
	}

	private setupListeners(): void {
		this.child.stdout?.once("end", this.onStdoutEnd);
		this.child.stderr?.once("end", this.onStderrEnd);
		this.child.once("error", this.onError);
		this.child.once("exit", this.onExit);
		this.child.once("close", this.onClose);
	}

	private cleanup = (): void => {
		if (this.postExitTimer) {
			clearTimeout(this.postExitTimer);
			this.postExitTimer = undefined;
		}
		this.child.removeListener("error", this.onError);
		this.child.removeListener("exit", this.onExit);
		this.child.removeListener("close", this.onClose);
		this.child.stdout?.removeListener("end", this.onStdoutEnd);
		this.child.stderr?.removeListener("end", this.onStderrEnd);
	};

	private finalize = (code: number | null): void => {
		if (this.settled) return;
		this.settled = true;
		this.cleanup();
		this.child.stdout?.destroy();
		this.child.stderr?.destroy();
		this.resolve(code);
	};

	private maybeFinalizeAfterExit = (): void => {
		if (!this.exited || this.settled) return;
		if (this.stdoutEnded && this.stderrEnded) {
			this.finalize(this.exitCode);
		}
	};

	private onStdoutEnd = (): void => {
		this.stdoutEnded = true;
		this.maybeFinalizeAfterExit();
	};

	private onStderrEnd = (): void => {
		this.stderrEnded = true;
		this.maybeFinalizeAfterExit();
	};

	private onError = (err: Error): void => {
		if (this.settled) return;
		this.settled = true;
		this.cleanup();
		this.reject(err);
	};

	private onExit = (code: number | null): void => {
		this.exited = true;
		this.exitCode = code;
		this.maybeFinalizeAfterExit();
		if (!this.settled) {
			this.postExitTimer = setTimeout(() => this.finalize(code), EXIT_STDIO_GRACE_MS);
		}
	};

	private onClose = (code: number | null): void => {
		this.finalize(code);
	};
}

/**
 * Wait for a child process to terminate without hanging on inherited stdio handles.
 *
 * On Windows, daemonized descendants can inherit the child's stdout/stderr pipe
 * handles. In that case the child emits `exit`, but `close` can hang forever even
 * though the original process is already gone. We wait briefly for stdio to end,
 * then forcibly stop tracking the inherited handles.
 */
export function waitForChildProcess(child: ChildProcess): Promise<number | null> {
	return new ChildProcessWaiter(child).wait();
}

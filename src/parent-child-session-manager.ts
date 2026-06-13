import type { AgentSession } from "@earendil-works/pi-coding-agent";

/**
 * Manager quản lý một parent session và một child session.
 * Runtime chỉ quản lý một session tại một thời điểm, nhưng manager này
 * giữ references đến cả hai và cung cấp methods để chuyển đổi giữa chúng.
 */
export class ParentChildSessionManager {
    private runtime: any; // AgentSessionRuntime - dùng any để tránh compile error với private types
    private _parentSession: AgentSession | null = null;
    private _childSession: AgentSession | null = null;
    private _isParentActive: boolean = true;

    constructor(runtime: any) {
        this.runtime = runtime;
        this._parentSession = runtime.session;
    }

    /**
     * Parent session - session gốc được tạo khi runtime khởi tạo.
     */
    get parentSession(): AgentSession {
        if (!this._parentSession) throw new Error("Parent session not available (may be disposed)");
        return this._parentSession;
    }

    /**
     * Child session - session con được tạo bằng createChildSession().
     * Có thể null nếu chưa tạo.
     */
    get childSession(): AgentSession | null {
        return this._childSession;
    }

    /**
     * Session hiện tại đang được runtime sử dụng.
     * (Dữ liệu thực tế lưu trong runtime.session)
     */
    get session(): AgentSession {
        return this.runtime.session;
    }

    /**
     * Trả về true nếu hiện tại đang dùng parent session, false nếu đang dùng child.
     */
    get isParentActive(): boolean {
        return this._isParentActive;
    }

    /**
     * Tạo child session mới.
     * Nếu đã có child, child cũ sẽ bị thay thế (không thể khôi phục).
     */
    async createChildSession(): Promise<void> {
        if (this._childSession) {
            console.warn(`Existing child session will be replaced: ${this._childSession!.sessionFile}`);
        }

        // Gọi runtime.newSession() để tạo child mới
        await this.runtime.newSession();

        // Lưu reference đến child mới
        this._childSession = this.runtime.session;
        this._isParentActive = false;

        console.log(`✅ Created child session: ${this._childSession!.sessionFile}`);
    }

    /**
     * Chuyển runtime về parent session.
     */
    async switchToParent(): Promise<void> {
        if (!this._parentSession) {
            throw new Error("Parent session not available (may be disposed)");
        }

        await this.runtime.switchSession(this._parentSession!.sessionFile);
        this._isParentActive = true;

        console.log(`🔄 Switched to parent session: ${this._parentSession!.sessionFile}`);
    }

    /**
     * Chuyển runtime về child session.
     * Lỗi nếu chưa tạo child.
     */
    async switchToChild(): Promise<void> {
        if (!this._childSession) {
            throw new Error("Child session not created yet. Call createChildSession() first.");
        }

        await this.runtime.switchSession(this._childSession!.sessionFile);
        this._isParentActive = false;

        console.log(`🔄 Switched to child session: ${this._childSession!.sessionFile}`);
    }

    /**
     * Dispose toàn bộ runtime (cả parent và child).
     */
    async dispose(): Promise<void> {
        await this.runtime.dispose();
        this._parentSession = null;
        this._childSession = null;
        console.log("🗑️ Disposed ParentChildSessionManager");
    }

    /**
     * Truy cập runtime gốc để gọi các phương thức khác nếu cần.
     */
    getRuntime(): any {
        return this.runtime;
    }
}

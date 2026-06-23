import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function getGitStatus(): Promise<{ dirty: boolean; files: string[] }> {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: process.cwd() });
    const lines = stdout.trim().split('\n').filter(Boolean);
    const files = lines.map(line => line.slice(3).trim());
    return { dirty: files.length > 0, files };
  } catch {
    return { dirty: false, files: [] };
  }
}

export async function commitAll(message: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync('git add -A', { cwd: process.cwd() });
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: process.cwd() });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function pushCommits(): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync('git push', { cwd: process.cwd() });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function hasRemote(): Promise<boolean> {
  try {
    await execAsync('git remote get-url origin', { cwd: process.cwd() });
    return true;
  } catch {
    return false;
  }
}

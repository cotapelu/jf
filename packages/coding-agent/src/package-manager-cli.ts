import chalk from "chalk";
import { APP_NAME, getAgentDir } from "./config.js";
import { selectConfig } from "./cli/config-selector.js";
import { SettingsManager } from "./core/settings-manager.js";
import { DefaultPackageManager } from "./core/package-manager.js";

function reportSettingsErrors(settingsManager: SettingsManager, context: string): void {
	const errors = settingsManager.drainErrors();
	for (const { scope, error } of errors) {
		console.error(chalk.yellow(`Warning (${context}, ${scope} settings): ${error.message}`));
		if (error.stack) {
			console.error(chalk.dim(error.stack));
		}
	}
}

function getPackageCommandUsage(command: string): string {
	switch (command) {
		case "install":
			return `${APP_NAME} install <source> [-l]`;
		case "remove":
			return `${APP_NAME} remove <source> [-l]`;
		case "update":
			return `${APP_NAME} update [source]`;
		case "list":
			return `${APP_NAME} list`;
	}
	return `${APP_NAME} <command>`;
}

function printInstallHelp(): void {
	console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("install")}

Install a package and add it to settings.

Options:
  -l, --local    Install project-locally (.pi/settings.json)

Examples:
  ${APP_NAME} install npm:@foo/bar
  ${APP_NAME} install git:github.com/user/repo
  ${APP_NAME} install git:git@github.com:user/repo
  ${APP_NAME} install https://github.com/user/repo
  ${APP_NAME} install ssh://git@github.com/user/repo
  ${APP_NAME} install ./local/path
`);
}

function printRemoveHelp(): void {
	console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("remove")}

Remove a package and its source from settings.
Alias: ${APP_NAME} uninstall <source> [-l]

Options:
  -l, --local    Remove from project settings (.pi/settings.json)

Examples:
  ${APP_NAME} remove npm:@foo/bar
  ${APP_NAME} uninstall npm:@foo/bar
`);
}

function printUpdateHelp(): void {
	console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("update")}

Update installed packages.
If <source> is provided, only that package is updated.
`);
}

function printListHelp(): void {
	console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("list")}

List installed packages from user and project settings.
`);
}

function printPackageCommandHelp(command: string): void {
	switch (command) {
		case "install":
			printInstallHelp();
			break;
		case "remove":
			printRemoveHelp();
			break;
		case "update":
			printUpdateHelp();
			break;
		case "list":
			printListHelp();
			break;
	}
}

function parseCommand(args: string[]): { command: string; rest: string[] } | null {
	const [rawCommand, ...rest] = args;
	let command: string | undefined;
	if (rawCommand === "uninstall") {
		command = "remove";
	} else if (["install", "remove", "update", "list"].includes(rawCommand)) {
		command = rawCommand;
	}
	if (!command) return null;
	return { command, rest };
}

function parseOption(
	arg: string,
	command: string,
	options: { local: boolean; help: boolean; invalidOption?: string; source?: string },
): void {
	if (arg === "-h" || arg === "--help") {
		options.help = true;
		return;
	}

	if (arg === "-l" || arg === "--local") {
		if (command === "install" || command === "remove") {
			options.local = true;
		} else {
			options.invalidOption = options.invalidOption ?? arg;
		}
		return;
	}

	if (arg.startsWith("-")) {
		options.invalidOption = options.invalidOption ?? arg;
		return;
	}

	if (!options.source) {
		options.source = arg;
	}
}

function parseArgs(rest: string[]): { local: boolean; help: boolean; invalidOption?: string; source?: string } {
	const options: { local: boolean; help: boolean; invalidOption?: string; source?: string } = {
		local: false,
		help: false,
	};

	for (const arg of rest) {
		parseOption(arg, "", options); // command will be set later
	}

	return options;
}

function parsePackageCommand(args: string[]): { command: string; source?: string; local: boolean; help: boolean; invalidOption?: string } | undefined {
	const parsed = parseCommand(args);
	if (!parsed) return undefined;

	const { command, rest } = parsed;
	const baseOptions = parseArgs(rest);

	return { command, source: baseOptions.source, local: baseOptions.local, help: baseOptions.help, invalidOption: baseOptions.invalidOption };
}

function createPackageManager(cwd: string, agentDir: string): DefaultPackageManager {
	const settingsManager = SettingsManager.create(cwd, agentDir);
	reportSettingsErrors(settingsManager, "package command");
	const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
	packageManager.setProgressCallback((event) => {
		if (event.type === "start") {
			process.stdout.write(chalk.dim(`${event.message}\n`));
		}
	});
	return packageManager;
}

function installPackage(packageManager: DefaultPackageManager, source: string, local: boolean): Promise<void> {
	return packageManager.installAndPersist(source, { local });
}

function removePackage(packageManager: DefaultPackageManager, source: string, local: boolean): Promise<boolean> {
	return packageManager.removeAndPersist(source, { local });
}

function executeInstall(packageManager: DefaultPackageManager, source: string, local: boolean): Promise<void> {
	return installPackage(packageManager, source, local)
		.then(() => console.log(chalk.green(`Installed ${source}`)));
}

function executeRemove(packageManager: DefaultPackageManager, source: string, local: boolean): Promise<boolean> {
	return removePackage(packageManager, source, local)
		.then((removed) => {
			if (!removed) {
				console.error(chalk.red(`No matching package found for ${source}`));
				process.exitCode = 1;
				return false;
			}
			console.log(chalk.green(`Removed ${source}`));
			return true;
		});
}

function listPackages(packageManager: DefaultPackageManager): void {
	const configuredPackages = packageManager.listConfiguredPackages();
	const userPackages = configuredPackages.filter((pkg) => pkg.scope === "user");
	const projectPackages = configuredPackages.filter((pkg) => pkg.scope === "project");

	if (configuredPackages.length === 0) {
		console.log(chalk.dim("No packages installed."));
		return;
	}

	const formatPackage = (pkg: (typeof configuredPackages)[number]) => {
		const display = pkg.filtered ? `${pkg.source} (filtered)` : pkg.source;
		console.log(`  ${display}`);
		if (pkg.installedPath) {
			console.log(chalk.dim(`    ${pkg.installedPath}`));
		}
	};

	if (userPackages.length > 0) {
		console.log(chalk.bold("User packages:"));
		for (const pkg of userPackages) {
			formatPackage(pkg);
		}
	}

	if (projectPackages.length > 0) {
		if (userPackages.length > 0) console.log();
		console.log(chalk.bold("Project packages:"));
		for (const pkg of projectPackages) {
			formatPackage(pkg);
		}
	}
}

function updatePackage(packageManager: DefaultPackageManager, source?: string): Promise<void> {
	return packageManager.update(source)
		.then(() => {
			if (source) {
				console.log(chalk.green(`Updated ${source}`));
			} else {
				console.log(chalk.green("Updated packages"));
			}
		});
}

export async function handleConfigCommand(args: string[]): Promise<boolean> {
	if (args[0] !== "config") {
		return false;
	}

	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	reportSettingsErrors(settingsManager, "config command");
	const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
	const resolvedPaths = await packageManager.resolve();

	await selectConfig({
		resolvedPaths,
		settingsManager,
		cwd,
		agentDir,
	});

	process.exit(0);
}

export async function handlePackageCommand(args: string[]): Promise<boolean> {
	const options = parsePackageCommand(args);
	if (!options) {
		return false;
	}

	if (options.help) {
		printPackageCommandHelp(options.command);
		return true;
	}

	if (options.invalidOption) {
		console.error(chalk.red(`Unknown option ${options.invalidOption} for "${options.command}".`));
		console.error(chalk.dim(`Use "${APP_NAME} --help" or "${getPackageCommandUsage(options.command)}".`));
		process.exitCode = 1;
		return true;
	}

	const source = options.source;
	if ((options.command === "install" || options.command === "remove") && !source) {
		console.error(chalk.red(`Missing ${options.command} source.`));
		console.error(chalk.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
		process.exitCode = 1;
		return true;
	}

	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	reportSettingsErrors(settingsManager, "package command");
	const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });

	packageManager.setProgressCallback((event) => {
		if (event.type === "start") {
			process.stdout.write(chalk.dim(`${event.message}\n`));
		}
	});

	try {
		switch (options.command) {
			case "install":
				await packageManager.installAndPersist(source!, { local: options.local });
				console.log(chalk.green(`Installed ${source}`));
				return true;

			case "remove": {
				const removed = await packageManager.removeAndPersist(source!, { local: options.local });
				if (!removed) {
					console.error(chalk.red(`No matching package found for ${source}`));
					process.exitCode = 1;
					return true;
				}
				console.log(chalk.green(`Removed ${source}`));
				return true;
			}

			case "list": {
				const configuredPackages = packageManager.listConfiguredPackages();
				const userPackages = configuredPackages.filter((pkg) => pkg.scope === "user");
				const projectPackages = configuredPackages.filter((pkg) => pkg.scope === "project");

				if (configuredPackages.length === 0) {
					console.log(chalk.dim("No packages installed."));
					return true;
				}

				const formatPackage = (pkg: (typeof configuredPackages)[number]) => {
					const display = pkg.filtered ? `${pkg.source} (filtered)` : pkg.source;
					console.log(`  ${display}`);
					if (pkg.installedPath) {
						console.log(chalk.dim(`    ${pkg.installedPath}`));
					}
				};

				if (userPackages.length > 0) {
					console.log(chalk.bold("User packages:"));
					for (const pkg of userPackages) {
						formatPackage(pkg);
					}
				}

				if (projectPackages.length > 0) {
					if (userPackages.length > 0) console.log();
					console.log(chalk.bold("Project packages:"));
					for (const pkg of projectPackages) {
						formatPackage(pkg);
					}
				}

				return true;
			}

			case "update":
				await packageManager.update(source);
				if (source) {
					console.log(chalk.green(`Updated ${source}`));
				} else {
					console.log(chalk.green("Updated packages"));
				}
				return true;
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Unknown package command error";
		console.error(chalk.red(`✗ Package command failed: ${message}`));
		process.exitCode = 1;
		return true;
	}
	return true;
}

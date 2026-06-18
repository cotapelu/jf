import { Container, Text, Spacer } from "@earendil-works/pi-tui";

/**
 * Add a styled header and spacer to a container.
 * Common pattern across renderers and custom UIs.
 */
export function addSectionHeader(container: Container, theme: any, title: string): void {
  container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
  container.addChild(new Spacer(1));
}

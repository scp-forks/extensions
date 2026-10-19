import {
  Action,
  ActionPanel,
  Icon,
  LaunchType,
  List,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { readFile } from "fs/promises";
import { useState } from "react";
import { DestructiveAction } from "./actions";
import { Command, CommandHook, Model } from "./type";
import packageJson from "../package.json";
import { COMMAND_MODEL_PREFIX, DEFAULT_COMMANDS, mapModelToCommand, useCommand } from "./hooks/useCommand";
import { CommandForm, iconsByContentSource } from "./views/command/from";
import CommandView, { CommandLaunchProps } from "./views/command/command-view";
import { ExportData } from "./utils/import-export";
import { ImportForm } from "./views/import-form";

export default function EntryPoint(props: CommandLaunchProps) {
  const requestModelId = props.launchContext?.commandId;
  if (requestModelId) {
    return <CommandView {...props} />;
  }
  return <SearchAiCommand />;
}

function SearchAiCommand() {
  const commands = useCommand();
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState<string>("");
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);

  const sortedCommands = Object.values(commands.data).sort((a, b) => a.name.localeCompare(b.name));
  const filteredCommands = sortedCommands
    .filter((value, index, self) => index === self.findIndex((cmd) => cmd.id === value.id))
    .filter((cmd) => {
      if (searchText === "") return true;
      return cmd.name.toLowerCase().includes(searchText.toLowerCase());
    });

  const getActionPanel = (cmd: Command) => (
    <ActionPanel>
      <Action
        title={"Open AI Command"}
        icon={Icon.AppWindowSidebarRight}
        onAction={() =>
          navigation.push(
            <CommandView
              arguments={{}}
              draftValues={{}}
              launchType={LaunchType.UserInitiated}
              launchContext={{ commandId: cmd.id }}
            />,
          )
        }
      />

      <ActionPanel.Section>
        <Action
          title={"Edit AI Command"}
          shortcut={{ modifiers: ["cmd"], key: "e" }}
          icon={Icon.Pencil}
          onAction={() => navigation.push(<CommandForm cmd={cmd} use={{ commands }} />)}
        />
        <Action
          title={"Create AI Command"}
          shortcut={{ modifiers: ["cmd"], key: "n" }}
          icon={Icon.NewDocument}
          onAction={() => navigation.push(<CommandForm use={{ commands }} />)}
        />
        <Action
          title={"Duplicate AI Command"}
          shortcut={{ modifiers: ["cmd"], key: "d" }}
          icon={Icon.Duplicate}
          onAction={() => navigation.push(<CommandForm cmd={cmd} isNew={true} use={{ commands }} />)}
        />
        <Action.CreateQuicklink
          quicklink={{
            name: cmd.name,
            link: `raycast://extensions/${packageJson.author}/${
              packageJson.name
            }/search-ai-command?context=${encodeURIComponent(JSON.stringify({ commandId: cmd.id }))}`,
          }}
        />
      </ActionPanel.Section>

      <ActionPanel.Section title="Import/Export">
        <Action
          title={"Export AI Commands"}
          icon={Icon.Upload}
          onAction={() => ExportData(commands.data, "AI Commands")}
        />
        <Action
          title={"Import AI Commands"}
          icon={Icon.Download}
          onAction={() =>
            navigation.push(<ImportForm moduleName="AI Commands" onSubmit={(file) => importCommands(file, commands)} />)
          }
        />
      </ActionPanel.Section>

      <ActionPanel.Section>
        {!commands.isDefault(cmd.id) && (
          <DestructiveAction
            title="Remove"
            dialog={{
              title: "Are you sure you want to remove this AI command from your collection?",
            }}
            icon={Icon.Trash}
            onAction={() => commands.remove(cmd)}
          />
        )}
        {commands.isDefault(cmd.id) && (
          <DestructiveAction
            title="Reset"
            dialog={{
              title: "Are you sure you want to reset this action to its default settings?",
            }}
            icon={Icon.Repeat}
            onAction={() => resetToDefaults(cmd, DEFAULT_COMMANDS, commands)}
            shortcut={null}
          />
        )}
        <DestructiveAction
          title={"Delete All"}
          dialog={{
            title:
              "Are you sure? All your custom AI commands will be deleted, and default AI commands will be recreated with their default values.",
          }}
          icon={Icon.Trash}
          onAction={commands.clear}
          shortcut={{ modifiers: ["shift", "ctrl"], key: "x" }}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );

  return (
    <List
      isShowingDetail={false}
      isLoading={commands.isLoading}
      filtering={false}
      throttle={false}
      selectedItemId={selectedCommandId || undefined}
      onSelectionChange={(id) => {
        if (id !== selectedCommandId) {
          setSelectedCommandId(id);
        }
      }}
      searchBarPlaceholder="Search AI commands..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
    >
      <List.Section title="Built-In">
        {filteredCommands
          .filter((cmd) => commands.isDefault(cmd.id))
          .map((cmd) => (
            <List.Item
              id={cmd.id}
              key={cmd.id}
              title={cmd.name}
              accessories={[{ icon: iconsByContentSource[cmd.contentSource] }, { text: cmd.model }]}
              actions={selectedCommandId === cmd.id ? getActionPanel(cmd) : undefined}
            />
          ))}
      </List.Section>
      <List.Section title="Custom">
        {filteredCommands
          .filter((cmd) => !commands.isDefault(cmd.id))
          .map((cmd) => (
            <List.Item
              id={cmd.id}
              key={cmd.id}
              title={cmd.name}
              accessories={[{ icon: iconsByContentSource[cmd.contentSource] }, { text: cmd.model }]}
              actions={selectedCommandId === cmd.id ? getActionPanel(cmd) : undefined}
            />
          ))}
      </List.Section>
      {searchText !== "" && (
        <List.Section title="Create New">
          <List.Item
            title={searchText}
            subtitle="Create new AI Command"
            icon={Icon.NewDocument}
            actions={
              <ActionPanel title="Create New">
                <Action
                  title="Create AI Command"
                  icon={Icon.NewDocument}
                  onAction={() => navigation.push(<CommandForm name={searchText} use={{ commands }} />)}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}

// Accepts an "Export AI Commands" file, or a "Export Models" file, in which AI commands are
// mirrored as models with id `command-<commandId>`. Merges into existing commands, keeping IDs
// so existing quicklinks keep working.
async function importCommands(file: string, commands: CommandHook) {
  try {
    const parsed: Record<string, Command | Model> | (Command | Model)[] = JSON.parse((await readFile(file)).toString());
    const imported = Object.values(parsed).flatMap((entry): Command[] => {
      if ("contentSource" in entry) return [entry];
      if (entry.id?.startsWith(`${COMMAND_MODEL_PREFIX}-`)) return [mapModelToCommand(entry)];
      return [];
    });

    if (imported.length === 0) {
      await showToast({ title: "No AI commands found", message: file, style: Toast.Style.Failure });
      return;
    }

    const confirmed = await confirmAlert({
      title: `Import ${imported.length} AI commands?`,
      message: `${imported.map((cmd) => cmd.name).join(", ")}\n\nCommands with the same ID will be overwritten.`,
      icon: Icon.Download,
      primaryAction: { title: "Import" },
    });
    if (!confirmed) return;

    await commands.setCommand({ ...commands.data, ...Object.fromEntries(imported.map((cmd) => [cmd.id, cmd])) });
    await showToast({
      title: `Imported ${imported.length} AI commands`,
      message: "Check the content source of each custom command",
      style: Toast.Style.Success,
    });
  } catch (error) {
    await showToast({
      title: "Failed to import AI commands",
      message: error instanceof Error ? error.message : String(error),
      style: Toast.Style.Failure,
    });
  }
}

function resetToDefaults(cmd: Command, defaultCommands: Record<string, Command>, commands: CommandHook) {
  const defaultCommand = defaultCommands[cmd.id];
  if (defaultCommand) {
    commands.update(defaultCommand);
  }
}

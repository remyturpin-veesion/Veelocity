import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/providers.dart';
import '../services/theme_provider.dart';

/// Settings dialog for GitHub and Linear API keys (stored encrypted on server).
class SettingsDialog extends ConsumerStatefulWidget {
  const SettingsDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showDialog<void>(
      context: context,
      builder: (context) => const SettingsDialog(),
    );
  }

  @override
  ConsumerState<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends ConsumerState<SettingsDialog> {
  final _githubTokenController = TextEditingController();
  final _githubReposController = TextEditingController();
  final _linearApiKeyController = TextEditingController();
  final _linearWorkspaceNameController = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  bool _githubConfigured = false;
  bool _linearConfigured = false;
  bool _storageAvailable = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final api = ref.read(apiServiceProvider);
    try {
      final data = await api.getSettings();
      if (!mounted) return;
      setState(() {
        _githubConfigured = data['github_configured'] as bool? ?? false;
        _githubReposController.text =
            (data['github_repos'] as String? ?? '').toString();
        _linearConfigured = data['linear_configured'] as bool? ?? false;
        _linearWorkspaceNameController.text =
            (data['linear_workspace_name'] as String? ?? '').toString();
        _storageAvailable = data['storage_available'] as bool? ?? true;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final api = ref.read(apiServiceProvider);
    final githubToken = _githubTokenController.text.trim();
    final githubRepos = _githubReposController.text.trim();
    final linearApiKey = _linearApiKeyController.text.trim();
    final linearWorkspaceName = _linearWorkspaceNameController.text.trim();
    if ((githubToken.isNotEmpty || linearApiKey.isNotEmpty) &&
        !_storageAvailable) {
      setState(() {
        _saving = false;
        _error = 'Server cannot store API keys (encryption not configured).';
      });
      return;
    }
    try {
      await api.updateSettings(
        githubToken: githubToken.isEmpty ? null : githubToken,
        githubRepos: githubRepos.isEmpty ? null : githubRepos,
        linearApiKey: linearApiKey.isEmpty ? null : linearApiKey,
        linearWorkspaceName:
            linearWorkspaceName.isEmpty ? null : linearWorkspaceName,
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        if (githubToken.isNotEmpty) _githubTokenController.clear();
        if (linearApiKey.isNotEmpty) _linearApiKeyController.clear();
      });
      await _loadSettings();
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString();
      });
    }
  }

  @override
  void dispose() {
    _githubTokenController.dispose();
    _githubReposController.dispose();
    _linearApiKeyController.dispose();
    _linearWorkspaceNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.settings),
          SizedBox(width: 8),
          Text('Settings'),
        ],
      ),
      content: SizedBox(
        width: 400,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          _error!,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.error,
                          ),
                        ),
                      ),
                    ],
                    if (!_storageAvailable)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          'API keys cannot be saved (server encryption not configured). Use environment variables.',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    _sectionTitle(theme, 'Appearance', null),
                    const SizedBox(height: 8),
                    _ThemeModeSelector(),
                    const SizedBox(height: 20),
                    _sectionTitle(theme, 'GitHub', _githubConfigured),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _githubTokenController,
                      decoration: const InputDecoration(
                        labelText: 'API key',
                        hintText: 'Leave blank to keep current',
                        border: OutlineInputBorder(),
                      ),
                      obscureText: true,
                      autocorrect: false,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _githubReposController,
                      decoration: const InputDecoration(
                        labelText: 'Repos (comma-separated)',
                        hintText: 'owner/repo1, owner/repo2',
                        border: OutlineInputBorder(),
                      ),
                      autocorrect: false,
                    ),
                    const SizedBox(height: 20),
                    _sectionTitle(theme, 'Linear', _linearConfigured),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _linearApiKeyController,
                      decoration: const InputDecoration(
                        labelText: 'API key',
                        hintText: 'Leave blank to keep current',
                        border: OutlineInputBorder(),
                      ),
                      obscureText: true,
                      autocorrect: false,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _linearWorkspaceNameController,
                      decoration: const InputDecoration(
                        labelText: 'Workspace name (optional)',
                        hintText: 'e.g. Veesion Linear',
                        border: OutlineInputBorder(),
                      ),
                      autocorrect: false,
                    ),
                  ],
                ),
              ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save'),
        ),
      ],
    );
  }

  Widget _sectionTitle(ThemeData theme, String label, bool? configured) {
    return Row(
      children: [
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.primary,
          ),
        ),
        if (configured != null) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: configured
                  ? theme.colorScheme.primaryContainer
                  : theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              configured ? 'Connected' : 'Not configured',
              style: theme.textTheme.labelSmall?.copyWith(
                color: configured
                    ? theme.colorScheme.onPrimaryContainer
                    : theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Theme mode selector: Light / Dark / System.
class _ThemeModeSelector extends ConsumerWidget {
  const _ThemeModeSelector();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return SegmentedButton<ThemeMode>(
      segments: const [
        ButtonSegment<ThemeMode>(
          value: ThemeMode.light,
          icon: Icon(Icons.light_mode, size: 18),
          label: Text('Light'),
        ),
        ButtonSegment<ThemeMode>(
          value: ThemeMode.dark,
          icon: Icon(Icons.dark_mode, size: 18),
          label: Text('Dark'),
        ),
        ButtonSegment<ThemeMode>(
          value: ThemeMode.system,
          icon: Icon(Icons.brightness_auto, size: 18),
          label: Text('System'),
        ),
      ],
      selected: {themeMode},
      onSelectionChanged: (Set<ThemeMode> selected) {
        final mode = selected.single;
        ref.read(themeModeProvider.notifier).setThemeMode(mode);
      },
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ),
      ),
    );
  }
}

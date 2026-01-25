import 'package:flutter/material.dart';

/// Repository selection data.
class RepoOption {
  final int? id;
  final String name;

  const RepoOption({this.id, required this.name});

  static const all = RepoOption(id: null, name: 'All repositories');
}

/// Dropdown for selecting a repository.
class RepoSelector extends StatelessWidget {
  final List<RepoOption> repos;
  final RepoOption selected;
  final ValueChanged<RepoOption> onChanged;

  const RepoSelector({
    super.key,
    required this.repos,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final allRepos = [RepoOption.all, ...repos];

    return DropdownButton<RepoOption>(
      value: allRepos.firstWhere(
        (r) => r.id == selected.id,
        orElse: () => RepoOption.all,
      ),
      items: allRepos.map((repo) {
        return DropdownMenuItem<RepoOption>(
          value: repo,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                repo.id == null ? Icons.folder_copy : Icons.folder,
                size: 18,
                color: Colors.grey[600],
              ),
              const SizedBox(width: 8),
              Text(repo.name),
            ],
          ),
        );
      }).toList(),
      onChanged: (value) {
        if (value != null) {
          onChanged(value);
        }
      },
      underline: const SizedBox.shrink(),
      borderRadius: BorderRadius.circular(8),
    );
  }
}

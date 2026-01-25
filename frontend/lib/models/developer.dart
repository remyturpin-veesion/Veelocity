// Developer models for team statistics.

/// Basic developer info with contribution counts.
class Developer {
  final String login;
  final String? avatar;
  final int prsCreated;
  final int prsMerged;
  final int reviewsGiven;
  final int commentsMade;

  Developer({
    required this.login,
    this.avatar,
    required this.prsCreated,
    required this.prsMerged,
    required this.reviewsGiven,
    required this.commentsMade,
  });

  factory Developer.fromJson(Map<String, dynamic> json) {
    return Developer(
      login: json['login'] as String,
      avatar: json['avatar'] as String?,
      prsCreated: json['prs_created'] as int,
      prsMerged: json['prs_merged'] as int,
      reviewsGiven: json['reviews_given'] as int,
      commentsMade: json['comments_made'] as int,
    );
  }

  int get totalContributions => prsCreated + reviewsGiven + commentsMade;
}

/// Detailed developer statistics.
class DeveloperStats {
  final String login;
  final int prsCreated;
  final int prsMerged;
  final int prsOpen;
  final int totalAdditions;
  final int totalDeletions;
  final double avgLinesPerPr;
  final double avgMergeHours;
  final int reviewsGiven;
  final int commentsMade;
  final int commitsMade;

  DeveloperStats({
    required this.login,
    required this.prsCreated,
    required this.prsMerged,
    required this.prsOpen,
    required this.totalAdditions,
    required this.totalDeletions,
    required this.avgLinesPerPr,
    required this.avgMergeHours,
    required this.reviewsGiven,
    required this.commentsMade,
    required this.commitsMade,
  });

  factory DeveloperStats.fromJson(Map<String, dynamic> json) {
    return DeveloperStats(
      login: json['login'] as String,
      prsCreated: json['prs_created'] as int,
      prsMerged: json['prs_merged'] as int,
      prsOpen: json['prs_open'] as int,
      totalAdditions: json['total_additions'] as int,
      totalDeletions: json['total_deletions'] as int,
      avgLinesPerPr: (json['avg_lines_per_pr'] as num).toDouble(),
      avgMergeHours: (json['avg_merge_hours'] as num).toDouble(),
      reviewsGiven: json['reviews_given'] as int,
      commentsMade: json['comments_made'] as int,
      commitsMade: json['commits_made'] as int,
    );
  }

  int get totalLines => totalAdditions + totalDeletions;
}

/// Response from developers list endpoint.
class DevelopersResponse {
  final String startDate;
  final String endDate;
  final int count;
  final List<Developer> developers;

  DevelopersResponse({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.developers,
  });

  factory DevelopersResponse.fromJson(Map<String, dynamic> json) {
    return DevelopersResponse(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      developers: (json['developers'] as List<dynamic>)
          .map((e) => Developer.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

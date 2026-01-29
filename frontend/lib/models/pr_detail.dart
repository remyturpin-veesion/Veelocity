/// PR detail for Individual PR Explorer (reviews, comments, commits, optional health).
class PRDetail {
  final int id;
  final int number;
  final String title;
  final String? body;
  final String state;
  final bool draft;
  final String authorLogin;
  final DateTime? createdAt;
  final DateTime? mergedAt;
  final int additions;
  final int deletions;
  final PRDetailRepository? repository;
  final List<PRDetailReview> reviews;
  final List<PRDetailComment> comments;
  final List<PRDetailCommit> commits;
  final PRDetailLimits? limits;
  final PRDetailHealth? health;

  PRDetail({
    required this.id,
    required this.number,
    required this.title,
    this.body,
    required this.state,
    required this.draft,
    required this.authorLogin,
    this.createdAt,
    this.mergedAt,
    required this.additions,
    required this.deletions,
    this.repository,
    required this.reviews,
    required this.comments,
    required this.commits,
    this.limits,
    this.health,
  });

  factory PRDetail.fromJson(Map<String, dynamic> json) {
    return PRDetail(
      id: json['id'] as int,
      number: json['number'] as int,
      title: json['title'] as String,
      body: json['body'] as String?,
      state: json['state'] as String,
      draft: json['draft'] as bool? ?? false,
      authorLogin: json['author_login'] as String,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      mergedAt: json['merged_at'] != null
          ? DateTime.parse(json['merged_at'] as String)
          : null,
      additions: json['additions'] as int? ?? 0,
      deletions: json['deletions'] as int? ?? 0,
      repository: json['repository'] != null
          ? PRDetailRepository.fromJson(
              json['repository'] as Map<String, dynamic>,
            )
          : null,
      reviews: (json['reviews'] as List<dynamic>?)
              ?.map((e) => PRDetailReview.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      comments: (json['comments'] as List<dynamic>?)
              ?.map((e) => PRDetailComment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      commits: (json['commits'] as List<dynamic>?)
              ?.map((e) => PRDetailCommit.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      limits: json['_limits'] != null
          ? PRDetailLimits.fromJson(json['_limits'] as Map<String, dynamic>)
          : null,
      health: json['health'] != null
          ? PRDetailHealth.fromJson(json['health'] as Map<String, dynamic>)
          : null,
    );
  }

  String get githubUrl {
    if (repository == null) return '';
    return 'https://github.com/${repository!.fullName}/pull/$number';
  }
}

class PRDetailRepository {
  final int id;
  final String fullName;

  PRDetailRepository({required this.id, required this.fullName});

  factory PRDetailRepository.fromJson(Map<String, dynamic> json) {
    return PRDetailRepository(
      id: json['id'] as int,
      fullName: json['full_name'] as String,
    );
  }
}

class PRDetailReview {
  final String reviewerLogin;
  final String state;
  final DateTime? submittedAt;

  PRDetailReview({
    required this.reviewerLogin,
    required this.state,
    this.submittedAt,
  });

  factory PRDetailReview.fromJson(Map<String, dynamic> json) {
    return PRDetailReview(
      reviewerLogin: json['reviewer_login'] as String,
      state: json['state'] as String,
      submittedAt: json['submitted_at'] != null
          ? DateTime.parse(json['submitted_at'] as String)
          : null,
    );
  }
}

class PRDetailComment {
  final String authorLogin;
  final String body;
  final DateTime? createdAt;

  PRDetailComment({
    required this.authorLogin,
    required this.body,
    this.createdAt,
  });

  factory PRDetailComment.fromJson(Map<String, dynamic> json) {
    return PRDetailComment(
      authorLogin: json['author_login'] as String,
      body: json['body'] as String,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }
}

class PRDetailCommit {
  final String sha;
  final String authorLogin;
  final String message;
  final DateTime? committedAt;

  PRDetailCommit({
    required this.sha,
    required this.authorLogin,
    required this.message,
    this.committedAt,
  });

  factory PRDetailCommit.fromJson(Map<String, dynamic> json) {
    return PRDetailCommit(
      sha: json['sha'] as String,
      authorLogin: json['author_login'] as String,
      message: json['message'] as String,
      committedAt: json['committed_at'] != null
          ? DateTime.parse(json['committed_at'] as String)
          : null,
    );
  }
}

class PRDetailLimits {
  final int reviewsShown;
  final int reviewsTotal;
  final int commentsShown;
  final int commentsTotal;
  final int commitsShown;
  final int commitsTotal;

  PRDetailLimits({
    required this.reviewsShown,
    required this.reviewsTotal,
    required this.commentsShown,
    required this.commentsTotal,
    required this.commitsShown,
    required this.commitsTotal,
  });

  factory PRDetailLimits.fromJson(Map<String, dynamic> json) {
    final rev = json['reviews'] as Map<String, dynamic>? ?? {};
    final com = json['comments'] as Map<String, dynamic>? ?? {};
    final cmt = json['commits'] as Map<String, dynamic>? ?? {};
    return PRDetailLimits(
      reviewsShown: rev['shown'] as int? ?? 0,
      reviewsTotal: rev['total'] as int? ?? 0,
      commentsShown: com['shown'] as int? ?? 0,
      commentsTotal: com['total'] as int? ?? 0,
      commitsShown: cmt['shown'] as int? ?? 0,
      commitsTotal: cmt['total'] as int? ?? 0,
    );
  }
}

class PRDetailHealth {
  final int healthScore;
  final String healthCategory;
  final Map<String, int> componentScores;
  final List<String> issues;

  PRDetailHealth({
    required this.healthScore,
    required this.healthCategory,
    required this.componentScores,
    required this.issues,
  });

  factory PRDetailHealth.fromJson(Map<String, dynamic> json) {
    final comp = json['component_scores'] as Map<String, dynamic>? ?? {};
    return PRDetailHealth(
      healthScore: json['health_score'] as int,
      healthCategory: json['health_category'] as String,
      componentScores: comp.map((k, v) => MapEntry(k, v as int)),
      issues: (json['issues'] as List<dynamic>?)?.cast<String>() ?? [],
    );
  }
}

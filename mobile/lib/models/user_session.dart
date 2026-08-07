class UserSession {
  final String token;
  final String username;
  final String role;
  final String orgId;

  UserSession({
    required this.token,
    required this.username,
    required this.role,
    required this.orgId,
  });
}

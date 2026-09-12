import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  login,
  logout,
  signUp,
  updatePassword,
  changePassword,
  resetPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";
import { getUserInfo } from "@/lib/user";
import {
  createTemporaryUser,
  logoutUser,
  runTrackedCleanups,
  type TemporaryUser,
} from "../framework/session";

describe("Authentication & User Session Functions", () => {
  let tempUser: TemporaryUser;

  beforeAll(async () => {
    tempUser = await createTemporaryUser({
      emailPrefix: faker.internet.username().toLowerCase(),
    });
  });

  beforeEach(async () => {
    await logoutUser();
  });

  afterAll(async () => {
    await logoutUser();
    await runTrackedCleanups();
  });

  it("getUserInfo returns null when no user is logged in", async () => {
    const user = await getUserInfo();
    expect(user).toBeNull();
  });

  it("login throws error when given invalid credentials", async () => {
    await expect(
      login({ email: faker.internet.email(), password: "wrong-password-123!" })
    ).rejects.toThrow();
  });

  it("login successfully authenticates and getUserInfo returns user details", async () => {
    const loginResult = await login({ email: tempUser.email, password: tempUser.password });

    expect(loginResult.user.email).toBe(tempUser.email);

    const currentUser = await getUserInfo();
    expect(currentUser).not.toBeNull();
    expect(currentUser?.email).toBe(tempUser.email);
    expect(currentUser?.id).toBe(tempUser.id);
  });

  it("logout clears active session cookies and user info becomes null", async () => {
    await login({ email: tempUser.email, password: tempUser.password });

    let user = await getUserInfo();
    expect(user?.email).toBe(tempUser.email);

    await logout();

    user = await getUserInfo();
    expect(user).toBeNull();
  });

  it("changePassword validates password match, length, and equality with current password", async () => {
    await login({ email: tempUser.email, password: tempUser.password });

    // Mismatched confirmation
    await expect(
      changePassword({
        currentPassword: tempUser.password,
        newPassword: "NewSecurePassword1!",
        confirmPassword: "DifferentPassword1!",
      })
    ).rejects.toThrow("New passwords do not match.");

    // Too short (< MIN_PASSWORD_LENGTH)
    await expect(
      changePassword({
        currentPassword: tempUser.password,
        newPassword: "123",
        confirmPassword: "123",
      })
    ).rejects.toThrow(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

    // Identical to current password
    await expect(
      changePassword({
        currentPassword: tempUser.password,
        newPassword: tempUser.password,
        confirmPassword: tempUser.password,
      })
    ).rejects.toThrow("New password must be different from your current password.");
  });

  it("changePassword rejects when unauthenticated or when current password is wrong", async () => {
    // Call when unauthenticated
    await expect(
      changePassword({
        currentPassword: tempUser.password,
        newPassword: "ValidNewPassword1!",
        confirmPassword: "ValidNewPassword1!",
      })
    ).rejects.toThrow("You must be signed in to change your password.");

    // Sign in and provide incorrect current password
    await login({ email: tempUser.email, password: tempUser.password });
    await expect(
      changePassword({
        currentPassword: "WrongCurrentPassword123!",
        newPassword: "ValidNewPassword1!",
        confirmPassword: "ValidNewPassword1!",
      })
    ).rejects.toThrow("Your current password is incorrect.");
  });

  it("changePassword successfully changes password and enables login with new password", async () => {
    const newPassword = `NewPass-${faker.string.alphanumeric(8)}!`;

    await login({ email: tempUser.email, password: tempUser.password });
    await changePassword({
      currentPassword: tempUser.password,
      newPassword,
      confirmPassword: newPassword,
    });

    await logoutUser();

    // Old password must fail
    await expect(
      login({ email: tempUser.email, password: tempUser.password })
    ).rejects.toThrow();

    // New password must succeed
    const newLogin = await login({ email: tempUser.email, password: newPassword });
    expect(newLogin.user.email).toBe(tempUser.email);
    tempUser.password = newPassword;
  });

  it("updatePassword updates the password for the active session", async () => {
    const newPassword = `UpdatePass-${faker.string.alphanumeric(8)}!`;

    await login({ email: tempUser.email, password: tempUser.password });
    await updatePassword({ password: newPassword });

    await logoutUser();

    const newLogin = await login({ email: tempUser.email, password: newPassword });
    expect(newLogin.user.email).toBe(tempUser.email);
    tempUser.password = newPassword;
  });

  it("signUp throws if repeatPassword does not match", async () => {
    await expect(
      signUp({
        email: faker.internet.email(),
        password: "PassWord123!",
        repeatPassword: "DifferentPassWord123!",
      })
    ).rejects.toThrow("Passwords do not match");
  });

  it("resetPassword dispatches reset email request without throwing", async () => {
    const res = await resetPassword({ email: faker.internet.email() });
    expect(res).toBeDefined();
  });
});

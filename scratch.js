const sessionUser = { id: 123, role: "authenticated" };
const role = "super_admin";
const name = "Test";
const result = { ...sessionUser, role, name };
console.log(result);

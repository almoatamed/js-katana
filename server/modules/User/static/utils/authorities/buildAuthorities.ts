import { localLogDecorator } from "$/server//utils/log/index.js";

const log = await localLogDecorator("Authorities Seeder", "blue", true, "Info");

async function seedAuthorities(authorities: import("./index.js").Authorities) {
    log("seeding authorities");

    //orm
    authorities.add({
        keyName: "orm",
        displayName: "Use ORM",
        displayDescription: "!!Allow the user to use ORM API!!",
    });

    authorities.add({
        keyName: "viewPrivateFiles",
        displayName: "View Private Files",
        displayDescription: "Allow the user to view private files",
    });

    authorities.add({
        keyName: "viewArchivePage",
        displayName: "View Archive Page",
        displayDescription: "Allow the user to See Archive Page",
        parentKeyName: "viewSettingsPage",
    });

    authorities.add({
        keyName: "viewArchivedUsers",
        displayName: "View Archived Users",
        displayDescription: "Allow the user to View Archived Users",
        parentKeyName: "viewArchivePage",
    });

    authorities.add({
        keyName: "restoreArchivedUsers",
        displayName: "Restore Archived Users",
        displayDescription: "Allow the user to Restore Archived Users",
        parentKeyName: "viewArchivedUsers",
    });

    authorities.add({
        keyName: "viewUserSettings",
        displayName: "View User Settings Page",
        displayDescription: "Allow the user to See User Settings Page",
        parentKeyName: "viewSettingsPage",
    });

    authorities.add({
        keyName: "viewListOfUsers",
        displayName: "View Users Pagination Page",
        displayDescription: "Allow the user to See Users Pagination Page",
        parentKeyName: "viewUserSettings",
    });

    authorities.add({
        keyName: "addUser",
        displayName: "Add New User",
        displayDescription: "Allow the user to Add New User",
        parentKeyName: "viewListOfUsers",
    });

    authorities.add({
        keyName: "deleteUser",
        displayName: "Delete User",
        displayDescription: "Allow the user to Delete User",
        parentKeyName: "viewListOfUsers",
    });

    authorities.add({
        keyName: "editUser",
        displayName: "Edit User",
        displayDescription: "Allow the user to Edit User",
        parentKeyName: "viewListOfUsers",
    });

    authorities.add({
        keyName: "deactivateUser",
        displayName: "Deactivate User",
        displayDescription: "Allow the user to Deactivate User",
        parentKeyName: "viewListOfUsers",
    });

    authorities.add({
        keyName: "activateUser",
        displayName: "Activate User",
        displayDescription: "Allow the user to Activate User",
        parentKeyName: "viewListOfUsers",
    });

    authorities.add({
        keyName: "changeUserPassword",
        displayName: "Change User Password",
        displayDescription: "Allow the user to Change User Password",
        parentKeyName: "viewListOfUsers",
    });

    authorities.add({
        keyName: "archiveUser",
        displayName: "Archive User",
        displayDescription: "Allow the user to Archive User",
        parentKeyName: "viewListOfUsers",
    });

    authorities.add({
        keyName: "viewUserActivityLogs",
        displayName: "View User Activity Logs",
        displayDescription: "Allow the user to View User Activity Logs",
        parentKeyName: "viewListOfUsers",
    });

    authorities.add({
        keyName: "changeUserAuthorities",
        displayName: "Change User authorities",
        displayDescription: "Allow the user to Change Users Authorities",
        parentKeyName: "viewListOfUsers",
    });

    log("finished");
}
export { seedAuthorities };

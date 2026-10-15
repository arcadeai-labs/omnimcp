/** Text of a System_ManageAuthorization status answer, as tool_response. */
export const authStatusResponse = (statuses) => [
  {
    type: "text",
    text: JSON.stringify({
      message: statuses.includes("authorization_required") ? "Not yet authorized: dropbox." : "All authorized.",
      providers: statuses.map((status, index) => ({ provider: `provider${index}`, status })),
    }),
  },
];

import apiClient from "../shared/api/apiClient";


/* ============================================================
   ADMIN CONTEXT SERVICE

   Secure Hotel Admin workspace context.

   Backend:
   GET /api/admin/context

   apiClient baseURL already includes /api,
   therefore request path is only:
   /admin/context
============================================================ */

const adminContextService = {

  /* ==========================================================
     GET ADMIN WORKSPACE CONTEXT
  ========================================================== */

  async getContext() {
    const response =
      await apiClient.get(
        "/admin/context"
      );


    const data =
      response?.data;


    if (
      !data ||
      data.success !== true
    ) {
      throw new Error(
        data?.message ||
        "The Hotel Admin workspace could not be loaded."
      );
    }


    return {
      admin:
        data.admin ||
        null,

      hotel:
        data.hotel ||
        null,

      pendingRequests:
        Number(
          data.pendingRequests ||
          0
        ),
    };
  },
};


export default adminContextService;
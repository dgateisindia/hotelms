import apiClient from "../shared/api/apiClient";

function ensureProfileResponse(
  response
) {
  const data =
    response?.data;


  if (
    !data ||
    data.success !== true ||
    !data.profile
  ) {
    throw new Error(
      data?.message ||
      "The HMS account profile could not be loaded."
    );
  }


  return data.profile;
}


const accountProfileService = {

  async getProfile() {
    const response =
      await apiClient.get(
        "/auth/profile"
      );


    return ensureProfileResponse(
      response
    );
  },


  async updateProfile({
    fullName,
    phone,
  }) {
    const response =
      await apiClient.patch(
        "/auth/profile",
        {
          fullName,
          phone,
        }
      );


    return ensureProfileResponse(
      response
    );
  },
};


export default accountProfileService;
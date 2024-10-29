/**
 *
 * @description
 * @UUID type-User
 */
export interface User {
  /**
   *
   * @description
   */
  id?: number;
  /**
   *
   * @description
   */
  username?: string;
  /**
   *
   * @description
   */
  firstName?: string;
  /**
   *
   * @description
   */
  lastName?: string;
  /**
   *
   * @description
   */
  email?: string;
  /**
   *
   * @description
   */
  password?: string;
  /**
   *
   * @description
   */
  phone?: string;
  /**
   *
   * @description User Status
   */
  userStatus?: number;
}

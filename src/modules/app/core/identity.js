export class AppIdentityModule {
  createId() {
    return `id_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }
}

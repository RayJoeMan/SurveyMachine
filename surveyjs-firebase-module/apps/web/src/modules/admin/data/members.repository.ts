import { httpsCallable } from "firebase/functions";
import type {
  ClaimInvitationInput,
  InviteMemberInput,
  ListMembersResult,
  MemberSummary,
  RemoveMemberInput,
  UpdateMemberRolesInput,
} from "@/contracts";
import { functions } from "@/firebase/client";

const listMembersCallable = httpsCallable<{ orgId: string }, ListMembersResult>(
  functions,
  "listMembersV1",
);
const inviteMemberCallable = httpsCallable<InviteMemberInput, { ok: true; requestId: string }>(
  functions,
  "inviteMemberV1",
);
const updateRolesCallable = httpsCallable<UpdateMemberRolesInput, { ok: true; requestId: string }>(
  functions,
  "updateMemberRolesV1",
);
const removeMemberCallable = httpsCallable<RemoveMemberInput, { ok: true; requestId: string }>(
  functions,
  "removeMemberV1",
);
const claimInvitationCallable = httpsCallable<
  ClaimInvitationInput,
  { ok: true; requestId: string }
>(functions, "claimInvitationV1");

export async function listMembers(orgId: string): Promise<MemberSummary[]> {
  const result = await listMembersCallable({ orgId });
  return result.data.members;
}

export async function inviteMember(input: InviteMemberInput): Promise<void> {
  await inviteMemberCallable(input);
}

export async function updateMemberRoles(input: UpdateMemberRolesInput): Promise<void> {
  await updateRolesCallable(input);
}

export async function removeMember(input: RemoveMemberInput): Promise<void> {
  await removeMemberCallable(input);
}

export async function claimInvitation(input: ClaimInvitationInput): Promise<void> {
  await claimInvitationCallable(input);
}

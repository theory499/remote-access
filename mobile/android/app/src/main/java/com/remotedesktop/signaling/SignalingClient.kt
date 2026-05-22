package com.remotedesktop.signaling

import com.google.firebase.database.ChildEventListener
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import com.google.firebase.database.ValueEventListener

class SignalingClient(
    private val database: FirebaseDatabase,
    private val uid: String,
    val sessionCode: String,
    private val role: Role = Role.CLIENT
) {
    enum class Role(val key: String) { HOST("host"), CLIENT("client") }

    private val peerRole: Role = if (role == Role.HOST) Role.CLIENT else Role.HOST

    private val sessionRef: DatabaseReference = database.getReference("sessions/$sessionCode")

    private val listeners = mutableListOf<Pair<DatabaseReference, Any>>()

    fun registerPresence(onComplete: (Throwable?) -> Unit = {}) {
        val ref = sessionRef.child(role.key)
        ref.setValue(mapOf(
            "uid" to uid,
            "createdAt" to ServerValue.TIMESTAMP
        )) { error, _ -> onComplete(error?.toException()) }
        ref.onDisconnect().removeValue()
    }

    fun watchPeerPresence(callback: (Map<*, *>?) -> Unit) {
        val ref = sessionRef.child(peerRole.key)
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                callback(snapshot.value as? Map<*, *>)
            }
            override fun onCancelled(error: DatabaseError) { /* propagate via no-op */ }
        }
        ref.addValueEventListener(listener)
        listeners.add(ref to listener)
    }

    fun watchOffer(callback: (SdpPayload) -> Unit) {
        val ref = sessionRef.child("offer")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val map = snapshot.value as? Map<*, *> ?: return
                SdpPayload.fromMap(map)?.let(callback)
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        ref.addValueEventListener(listener)
        listeners.add(ref to listener)
    }

    fun sendOffer(payload: SdpPayload, onComplete: (Throwable?) -> Unit = {}) {
        sessionRef.child("offer").setValue(payload.toMap()) { error, _ ->
            onComplete(error?.toException())
        }
    }

    fun watchAnswer(callback: (SdpPayload) -> Unit) {
        val ref = sessionRef.child("answer")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val map = snapshot.value as? Map<*, *> ?: return
                SdpPayload.fromMap(map)?.let(callback)
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        ref.addValueEventListener(listener)
        listeners.add(ref to listener)
    }

    fun sendAnswer(payload: SdpPayload, onComplete: (Throwable?) -> Unit = {}) {
        sessionRef.child("answer").setValue(payload.toMap()) { error, _ ->
            onComplete(error?.toException())
        }
    }

    fun sendIceCandidate(candidate: IceCandidatePayload, onComplete: (Throwable?) -> Unit = {}) {
        val ref = sessionRef.child("iceCandidates/${role.key}").push()
        ref.setValue(candidate.toMap()) { error, _ -> onComplete(error?.toException()) }
    }

    fun watchIceCandidates(callback: (IceCandidatePayload) -> Unit) {
        val ref = sessionRef.child("iceCandidates/${peerRole.key}")
        val listener = object : ChildEventListener {
            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {
                val map = snapshot.value as? Map<*, *> ?: return
                IceCandidatePayload.fromMap(map)?.let(callback)
            }
            override fun onChildChanged(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onChildRemoved(snapshot: DataSnapshot) {}
            override fun onChildMoved(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onCancelled(error: DatabaseError) {}
        }
        ref.addChildEventListener(listener)
        listeners.add(ref to listener)
    }

    fun dispose() {
        for ((ref, listener) in listeners) {
            when (listener) {
                is ValueEventListener -> ref.removeEventListener(listener)
                is ChildEventListener -> ref.removeEventListener(listener)
            }
        }
        listeners.clear()
    }
}

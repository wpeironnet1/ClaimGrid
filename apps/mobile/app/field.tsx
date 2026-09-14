import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addFieldObservation, createFieldObservation, describeGpsQuality, parseFieldObservations, type FieldObservation, type FieldObservationKind } from "@claimgrid/core";

const STORAGE_KEY = "claimgrid.field-observations.v1";

const kinds: { value: FieldObservationKind; label: string }[] = [
  { value: "site", label: "Site" }, { value: "monument", label: "Monument" }, { value: "corner-candidate", label: "Corner candidate" },
  { value: "sample", label: "Sample" }, { value: "access", label: "Access" }, { value: "hazard", label: "Hazard" }
];

export default function FieldCapture() {
  const [kind, setKind] = useState<FieldObservationKind>("site");
  const [note, setNote] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [records, setRecords] = useState<FieldObservation[]>([]);

  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then(raw => setRecords(parseFieldObservations(raw))).catch(() => undefined); }, []);

  async function saveRecords(next: FieldObservation[]) {
    setRecords(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function capture() {
    setCapturing(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { Alert.alert("Location permission needed", "ClaimGrid only reads location when you tap Capture GPS observation."); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const record = createFieldObservation({ kind, note, latitude: position.coords.latitude, longitude: position.coords.longitude, horizontalAccuracyMeters: position.coords.accuracy, altitudeMeters: position.coords.altitude, capturedAt: new Date(position.timestamp).toISOString() });
      const next = addFieldObservation(records, record);
      await saveRecords(next); setNote("");
    } catch (error) { Alert.alert("Unable to capture GPS", error instanceof Error ? error.message : "Try again with a clear view of the sky."); }
    finally { setCapturing(false); }
  }

  function remove(record: FieldObservation) {
    Alert.alert("Delete field observation?", "This removes the on-device record and cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { void saveRecords(records.filter(item => item.id !== record.id)); } }]);
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>FIELD EVIDENCE</Text><Text style={styles.title}>Capture what you actually see.</Text>
    <View style={styles.warning}><Text style={styles.warningTitle}>Not a legal survey or claim corner</Text><Text style={styles.warningText}>Phone GPS can drift. These observations do not mark boundaries, establish discovery, prove land availability, or replace monuments and official records.</Text></View>
    <Text style={styles.label}>Observation type</Text><View style={styles.chips}>{kinds.map(item => <TouchableOpacity accessibilityRole="button" accessibilityState={{selected: kind === item.value}} key={item.value} onPress={() => setKind(item.value)} style={[styles.chip, kind === item.value && styles.chipActive]}><Text style={[styles.chipText, kind === item.value && styles.chipTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
    <Text style={styles.label}>Field note</Text><TextInput style={styles.input} multiline maxLength={2000} value={note} onChangeText={setNote} placeholder="Describe markings, access, terrain, or what you observed…" placeholderTextColor="#788078" />
    <TouchableOpacity disabled={capturing} onPress={capture} style={[styles.capture, capturing && styles.disabled]}><Text style={styles.captureText}>{capturing ? "Acquiring high-accuracy reading…" : "Capture GPS observation"}</Text></TouchableOpacity>
    <Text style={styles.session}>SAVED ON THIS DEVICE · {records.length} RECORD{records.length === 1 ? "" : "S"}</Text>
    {records.length === 0 ? <Text style={styles.empty}>Captured observations will appear here. Keep independent backups before leaving the field.</Text> : records.map(record => { const quality = describeGpsQuality(record.horizontalAccuracyMeters); return <View key={record.id} style={styles.card}><View style={styles.cardTop}><Text style={styles.kind}>{record.kind.replace("-", " ").toUpperCase()}</Text><Text style={[styles.quality, styles[quality]]}>{quality.toUpperCase()} GPS</Text></View><Text style={styles.coords}>{record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}</Text><Text style={styles.meta}>± {record.horizontalAccuracyMeters?.toFixed(1) ?? "unknown"} m · {new Date(record.capturedAt).toLocaleString()}</Text>{record.note ? <Text style={styles.note}>{record.note}</Text> : null}<View style={styles.cardFoot}><Text style={styles.evidence}>DEVICE READING ONLY</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${record.kind} observation`} onPress={() => remove(record)}><Text style={styles.delete}>Delete</Text></TouchableOpacity></View></View>; })}
  </ScrollView>;
}

const styles = StyleSheet.create({page:{backgroundColor:"#f5f1e7"},content:{padding:22,paddingTop:36,paddingBottom:70},kicker:{fontSize:11,letterSpacing:2,color:"#9b583d",fontWeight:"800"},title:{fontFamily:"Georgia",fontSize:42,lineHeight:45,color:"#172018",marginTop:12,marginBottom:20},warning:{backgroundColor:"#172018",padding:18,borderRadius:10},warningTitle:{color:"#f5f1e7",fontWeight:"800",marginBottom:7},warningText:{color:"#c3cbc1",fontSize:13,lineHeight:19},label:{fontWeight:"800",color:"#283128",marginTop:25,marginBottom:10},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderColor:"#b9b7ae",paddingVertical:9,paddingHorizontal:12,borderRadius:20},chipActive:{backgroundColor:"#9b583d",borderColor:"#9b583d"},chipText:{fontSize:12,color:"#3e483f",fontWeight:"700"},chipTextActive:{color:"white"},input:{minHeight:110,textAlignVertical:"top",borderWidth:1,borderColor:"#bbb8ae",borderRadius:9,backgroundColor:"white",padding:14,color:"#172018",fontSize:15},capture:{backgroundColor:"#9b583d",padding:17,alignItems:"center",borderRadius:8,marginTop:14},disabled:{opacity:.55},captureText:{color:"white",fontWeight:"800"},session:{fontSize:11,letterSpacing:1.5,color:"#9b583d",fontWeight:"800",marginTop:34,marginBottom:12},empty:{color:"#687168",fontSize:13,lineHeight:20},card:{backgroundColor:"white",borderWidth:1,borderColor:"#dad5ca",padding:17,borderRadius:10,marginBottom:12},cardTop:{flexDirection:"row",justifyContent:"space-between"},kind:{fontSize:11,letterSpacing:1.2,fontWeight:"800",color:"#8f4d35"},quality:{fontSize:10,fontWeight:"800"},strong:{color:"#397144"},moderate:{color:"#8a671f"},weak:{color:"#a33d2d"},unknown:{color:"#687168"},coords:{fontFamily:"monospace",fontSize:18,fontWeight:"700",color:"#172018",marginTop:11},meta:{fontSize:12,color:"#687168",marginTop:5},note:{fontSize:14,lineHeight:20,color:"#39433a",marginTop:14},cardFoot:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:14},evidence:{fontSize:9,letterSpacing:1.3,color:"#8a918a",fontWeight:"800"},delete:{color:"#9b3f2d",fontSize:12,fontWeight:"800"}});

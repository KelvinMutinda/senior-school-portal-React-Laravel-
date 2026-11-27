<?php
namespace App\Http\Controllers;

use App\Models\StaffProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Suport\Facades\DB;


class TeacherDashboardController extends Controller{

public function show(Request $request):JsonResponse{
    $user=$request->user();
    abort_unless(strtoupper($user->role)==='TEACHER',403,'This page is for teachers');

    $Teacher=StaffProfile::where('user_id',$user->id)->first();
    
    $profile=DB::table('staff_profiles')->where('id',$Teacher->staff_profile_id)->first();
    $grades=DB::table('staff_grade')->where('id',$grade->$grade_id)->first();
    $subjects=DB::table('staff_subjects')->where('id',$subjects->subject_id)->first();
    $department=DB::table('departments')->where('id',$department->department_id);

    return response()->json([
        'firstName'=>$Teacher->first_name,
        'lastName'=>$Teacher->surname,
        'staffNumber'=>$Teacher->staffNo,
        'tscNumber'=>$Teacher->tsc_number,
        'idNumber'=>$Teacher->id_number,
        'phoneNumber'=>$Teacher->phone_no,
        'subjects'=>$subjects? ($subjectNames[$subjects->slug])
    
    }   
   


}